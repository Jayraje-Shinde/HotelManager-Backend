import prisma from "../../config/db";
import {
	round2,
	applyDiscount,
	getShotRate,
	aggregateSealedItems,
	aggregateShotUsages,
	consumeBatchesFIFO,
	linkShotUsagesToBillItem,
	finalizePaidBill,
	markTableOccupied
} from "./billing.utils";

import { CreateBillingInput, PaymentInput } from "../../types/billing";

/**
 * FIRST BILLING:
 * - Builds BillItems from SERVED KOTs
 * - Handles sealed liquor FIFO
 * - Handles shots (already deducted at KOT time)
 * - Links shots to BillItems
 * - Requires at least 1 payment
 * - Partial payment allowed
 */
export async function createBillFromKOT(payload: CreateBillingInput) {
	if (!payload.table_no) throw new Error("table_no_required");

	if (!payload.payments || payload.payments.length === 0) {
		throw new Error("first_billing_requires_payment");
	}

	const result = await prisma.$transaction(async (tx) => {
		// 1. Find open bill
		const bill = await tx.bill.findFirst({
			where: { table_no: payload.table_no, status: "OPEN" },
			orderBy: { id: "desc" }
		});
		if (!bill) throw new Error("no_open_bill_for_table");

		// Prevent re-init
		const existing = await tx.billItem.count({ where: { bill_id: bill.id } });
		if (existing > 0) throw new Error("bill_already_initialized_use_pay_endpoint");

		// 2. Load SERVED KOTs
		const kots = await tx.kOT.findMany({
			where: { bill_id: bill.id, status: "SERVED" }
		});
		if (kots.length === 0) throw new Error("no_served_kots");

		const kotIds = kots.map((k) => k.id);

		// 3. Load KOT items
		const kotItems = await tx.kOTItem.findMany({
			where: { kot_id: { in: kotIds } }
		});

		// 4. Load shot usages (with bottle relation)
		const shotUsages = await tx.liquorShotUsage.findMany({
			where: { kot_id: { in: kotIds }, bill_item_id: null },
			include: { openBottle: true }
		});

		// 5. Sealed + shot grouping
		const sealedMap = aggregateSealedItems(kotItems);
		const shotMap = aggregateShotUsages(shotUsages);

		// 6. Fetch item metadata
		const itemIds = Array.from(
			new Set([
				...sealedMap.keys(),
				...Array.from(shotMap.values()).map((s: any) => s.item_id)
			])
		);

		const items = await tx.item.findMany({
			where: { id: { in: itemIds } }
		});

		const itemById = new Map(items.map((i) => [i.id, i]));

		// 7. Build BillItems
		let computedTotal = 0;
		const createdBillItems: any[] = [];

		// ----------------------------
		// SEALED LIQUOR + NON-LIQUOR
		// ----------------------------
		for (const [item_id, qty] of sealedMap.entries()) {
			if (qty <= 0) continue;

			const item = itemById.get(item_id);
			if (!item) throw new Error(`item_not_found:${item_id}`);

			const rate = item.selling_price ?? 0;
			const subtotal = round2(rate * qty);

			const billItem = await tx.billItem.create({
				data: {
					bill_id: bill.id,
					item_id,
					quantity: qty,
					rate,
					subtotal
				}
			});

			createdBillItems.push(billItem);
			computedTotal += subtotal;

			// sealed liquor → FIFO batch consumption
			if (item.is_liquor) {
				await consumeBatchesFIFO(
					tx,
					billItem.id,
					item_id,
					qty,
					bill.id,
					payload.user_id
				);
			} else {
				// non-liquor → update item.stock
				if (item.manage_stock) {
					await tx.item.update({
						where: { id: item_id },
						data: { stock: (item.stock ?? 0) - qty }
					});

					await tx.stockMovement.create({
						data: {
							item_id,
							change_qty: -qty,
							reason: `Sale Bill ${bill.id}`,
							movement_type: "SALE",
							ref_id: bill.id,
							created_by: payload.user_id ?? null
						}
					});
				}
			}
		}

		// ----------------------------
		// SHOTS
		// ----------------------------
		for (const [key, grp] of shotMap.entries()) {
			const { item_id, ml_used, count } = grp;

			const item = itemById.get(item_id);
			if (!item) throw new Error(`item_not_found:${item_id}`);

			const rate = getShotRate(item, ml_used);
			const subtotal = round2(rate * count);

			const billItem = await tx.billItem.create({
				data: {
					bill_id: bill.id,
					item_id,
					quantity: count,
					rate,
					subtotal
				}
			});

			createdBillItems.push(billItem);
			computedTotal += subtotal;

			// link shot usages → this BillItem
			await linkShotUsagesToBillItem(tx, billItem.id, kotIds, item_id, ml_used);
		}

		// ----------------------------
		// DISCOUNT
		// ----------------------------
		const finalTotal = applyDiscount(
			computedTotal,
			payload.discount_flat ?? null,
			payload.discount_percent ?? null
		);

		// update totals
		await tx.bill.update({
			where: { id: bill.id },
			data: {
				total: finalTotal,
				discount: payload.discount_flat ?? payload.discount_percent ?? 0
			}
		});

		// ----------------------------
		// PAYMENTS (first billing)
		// ----------------------------
		let paidSum = 0;
		for (const pay of payload.payments) {
			await tx.payment.create({
				data: {
					billId: bill.id,
					method: pay.method as any,
					amount: pay.amount,
					referenceNo: null
				}
			});
			paidSum += pay.amount;
		}

		if (paidSum > finalTotal) {
			throw new Error(`payment_overflow: required ${finalTotal}, received ${paidSum}`);
		}

		// FULL or PARTIAL settlement
		if (paidSum === finalTotal) {
			// bill → PAID
			await tx.bill.update({
				where: { id: bill.id },
				data: { status: "PAID" }
			});

			await finalizePaidBill(tx, bill);
		} else {
			// bill → OPEN (partial payment)
			await tx.bill.update({
				where: { id: bill.id },
				data: { status: "OPEN" }
			});

			await markTableOccupied(tx, bill.table_no, bill.id);
		}

		// return full bill
		const full = await tx.bill.findUnique({
			where: { id: bill.id },
			include: {
				items: { include: { batches: true, shotUsage: true } },
				payments: true
			}
		});

		return full;
	});

	return result;
}

/**
 * ADD PAYMENT to existing bill
 * - Partial payments allowed
 * - Marks PAID only when total paid equals total
 */
export async function addPaymentToBill(
	billId: number,
	payments: PaymentInput[]
) {
	if (!Array.isArray(payments) || payments.length === 0) {
		throw new Error("no_payments_provided");
	}

	const result = await prisma.$transaction(async (tx) => {
		const bill = await tx.bill.findUnique({ where: { id: billId } });
		if (!bill) throw new Error("bill_not_found");

		const agg = await tx.payment.aggregate({
			where: { billId },
			_sum: { amount: true }
		});

		const existingPaid = agg._sum.amount ?? 0;
		let newPaid = 0;

		// create new payment entries
		for (const p of payments) {
			await tx.payment.create({
				data: {
					billId,
					method: p.method as any,
					amount: p.amount,
					referenceNo: null
				}
			});
			newPaid += p.amount;
		}

		const totalPaid = round2(existingPaid + newPaid);

		const payable = round2(bill.total - (bill.discount ?? 0));
		if (totalPaid > payable) {
			throw new Error(`payment_overflow: required ${bill.total}, received ${totalPaid}`);
		}

		if (totalPaid === payable) {
			// FULL settlement → PAID
			await tx.bill.update({
				where: { id: billId },
				data: { status: "PAID" }
			});

			await finalizePaidBill(tx, bill);
		} else {
			// still OPEN
			await tx.bill.update({
				where: { id: billId },
				data: { status: "OPEN" }
			});

			await markTableOccupied(tx, bill.table_no, billId);
		}

		return await tx.bill.findUnique({
			where: { id: billId },
			include: {
				items: { include: { batches: true, shotUsage: true } },
				payments: true
			}
		});
	});

	return result;
}

/**
 * GET bill by ID
 */
export async function getBill(billId: number) {
	return prisma.bill.findUnique({
		where: { id: billId },
		include: {
			items: { include: { batches: true, shotUsage: true } },
			payments: true
		}
	});
}
