import prisma from "../../config/db";
import { Prisma } from "@prisma/client";
import { CreateBillInput, CreateBillFromKOTInput, PaymentInput } from "./billing.types";
import {
	aggregateSealedItems,
	aggregateShotUsages,
	consumeBatchesFIFO,
	linkShotUsagesToBillItem,
	finalizePaidBill,
	applyDiscount,
	getShotRate
} from "./billing.utils";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";

/**
 * Core billing service functions:
 * - createBill
 * - createBillFromKOT
 * - addPaymentToBill
 * - getBill
 * - rollbackBill
 */

// Small helper
function computeSubtotal(qty: number, price: number) {
	return Math.round((qty * price) * 100) / 100;
}

export async function createBill(payload: CreateBillInput) {
	if (!payload.items || payload.items.length === 0) throw new Error("no_items");

	// collect bottles finished inside tx to audit after tx
	const finishedBottleIds: number[] = [];

	const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		// 1) create bill (OPEN or CLOSED depending on payment/ is_temp flag)
		const bill = await tx.bill.create({
			data: {
				table_no: payload.table_no,
				user_id: payload.user_id ?? null,
				total: 0,
				discount: 0,
				paymentMode: null,
				bill_date: new Date(),
				status: payload.is_temp ? "OPEN" : "OPEN" // will set PAID later if payments provided
			}
		});

		let computedTotal = 0;
		// process each input line
		for (const input of payload.items) {
			const item = await tx.item.findUnique({ where: { id: input.item_id } });
			if (!item) throw new Error(`item_not_found:${input.item_id}`);

			const sellingPrice = typeof input.price === "number" ? input.price : item.selling_price ?? 0;

			// SHOT flow (real-time ml deduction from open bottles)
			if (input.shot_ml && item.is_liquor) {
				const qty = input.quantity ?? 1;
				const totalMl = qty * input.shot_ml;

				// find open bottle FIFO
				const open = await tx.openLiquorBottle.findFirst({
					where: { item_id: item.id, status: "OPEN", ml_remaining: { gt: 0 } },
					orderBy: { opened_at: "asc" }
				});

				if (!open) {
					const err: any = new Error("PROMPT_BREAK_BOTTLE");
					err.code = "PROMPT_BREAK_BOTTLE";
					err.item_id = item.id;
					throw err;
				}

				if (open.ml_remaining < totalMl) {
					const err: any = new Error("PROMPT_BREAK_BOTTLE");
					err.code = "PROMPT_BREAK_BOTTLE";
					err.item_id = item.id;
					err.open_bottle_id = open.id;
					err.ml_remaining = open.ml_remaining;
					err.remaining_ml_needed = totalMl - open.ml_remaining;
					throw err;
				}

				// create bill item (for the shot)
				const billItem = await tx.billItem.create({
					data: {
						bill_id: bill.id,
						item_id: item.id,
						quantity: qty,
						rate: sellingPrice,
						subtotal: computeSubtotal(qty, sellingPrice)
					}
				});

				computedTotal += billItem.subtotal;

				// deduct ml
				const newMl = open.ml_remaining - totalMl;
				await tx.openLiquorBottle.update({
					where: { id: open.id },
					data: {
						ml_remaining: newMl,
						status: newMl === 0 ? "FINISHED" : open.status,
						closed_at: newMl === 0 ? new Date() : null
					}
				});

				// create liquor shot usage (linked to bill item)
				await tx.liquorShotUsage.create({
					data: {
						bill_item_id: billItem.id,
						open_bottle_id: open.id,
						ml_used: totalMl,
						used_at: new Date()
					}
				});

				if (newMl === 0) finishedBottleIds.push(open.id);

				continue;
			}

			// SEALED or NON-LIQUOR items
			const qtyToSell = input.quantity ?? 1;

			// check stock for managed items
			if (item.manage_stock) {
				const currentStock = item.stock ?? 0;
				if (currentStock < qtyToSell) throw new Error(`INSUFFICIENT_STOCK:${item.id}`);
			}

			// create bill item
			const billItem = await tx.billItem.create({
				data: {
					bill_id: bill.id,
					item_id: item.id,
					quantity: qtyToSell,
					rate: sellingPrice,
					subtotal: computeSubtotal(qtyToSell, sellingPrice)
				}
			});

			computedTotal += billItem.subtotal;

			// if liquor sealed: consume FIFO batches and record billItemBatch + stock movements
			if (item.is_liquor) {
				const usedBatches = await consumeBatchesFIFO(tx, billItem.id, item.id, qtyToSell, bill.id, payload.user_id ?? null);
				// consumeBatchesFIFO writes billItemBatch and stockMovement inside util
				// no further action needed here
				// Optionally capture ml_used for billItemBatch done in utility or here if utility returns details
			} else {
				// non-liquor: single stock decrement and stock movement
				if (item.manage_stock) {
					await tx.item.update({
						where: { id: item.id },
						data: { stock: (item.stock ?? 0) - qtyToSell }
					});

					await tx.stockMovement.create({
						data: {
							item_id: item.id,
							change_qty: -qtyToSell,
							reason: `Sale Bill ${bill.id}`,
							movement_type: "SALE",
							ref_id: bill.id,
							created_by: payload.user_id ?? null,
							created_at: new Date()
						}
					});
				}
			}
		} // end for items

		// apply discount
		const finalTotal = applyDiscount(computedTotal, payload.discount_flat ?? null, payload.discount_percent ?? null);

		// update bill totals
		await tx.bill.update({ where: { id: bill.id }, data: { total: finalTotal, discount: payload.discount_flat ?? payload.discount_percent ?? 0 } });

		// payments handling: expect single submission of payments (sum must match finalTotal)
		if (payload.payments && payload.payments.length > 0) {
			let paidSum = 0;
			for (const p of payload.payments) {
				await tx.payment.create({
					data: {
						billId: bill.id,
						// Prisma enum type; cast to any to avoid TS enum mismatch if needed
						method: (p.method as any),
						amount: p.amount,
						referenceNo: p.referenceNo ?? null
					}
				});
				paidSum += p.amount;
			}

			if (Math.abs(paidSum - finalTotal) > 0.001) {
				throw new Error(`payment_mismatch: required ${finalTotal}, received ${paidSum}`);
			}

			await tx.bill.update({ where: { id: bill.id }, data: { status: "PAID" } });

			// finalize paid bill: close served kots and free table
			await finalizePaidBill(tx, { id: bill.id, table_no: bill.table_no });
		} else {
			// keep OPEN (frontend may send payment later). If is_temp true we also keep OPEN.
			await tx.bill.update({ where: { id: bill.id }, data: { status: "OPEN" } });
			// mark table occupied
			await tx.tableStatus.upsert({
				where: { table_no: bill.table_no },
				update: { status: "OCCUPIED", current_bill_id: bill.id },
				create: { table_no: bill.table_no, zone: payload.zone ?? "", status: "OCCUPIED", current_bill_id: bill.id }
			});
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
	}); // end transaction

	// audit finished bottles outside tx
	if ((finishedBottleIds ?? []).length > 0) {
		for (const b of finishedBottleIds) {
			try {
				await audit(payload.user_id ?? null, AuditEvent.BOTTLE_FINISH, `Bottle #${b} finished during billing`);
			} catch (e) {
				// ignore audit failures
				console.warn("Audit failed for bottle finish", b, e);
			}
		}
	}

	return created;
}

export async function createBillFromKOT(payload: CreateBillFromKOTInput) {
	// load KOTs
	let kots;
	if (payload.kot_ids && payload.kot_ids.length > 0) {
		kots = await prisma.kOT.findMany({ where: { id: { in: payload.kot_ids } }, include: { items: true, liquorShotUsages: true } });
		if (!kots || kots.length === 0) throw new Error("kot_not_found");
	} else if (payload.table_no) {
		// gather non-closed KOTs for table
		kots = await prisma.kOT.findMany({
			where: {
				table_no: payload.table_no,
				status: { notIn: ["CLOSED", "CANCELLED"] }
			},
			include: { items: true, liquorShotUsages: true }
		});
		if (!kots || kots.length === 0) throw new Error("kot_not_found");
	} else {
		throw new Error("provide_kot_ids_or_table_no");
	}

	// Build aggregated sealed items map and shot usages
	const allKotItems: any[] = [];
	const allShotUsages: any[] = [];

	for (const k of kots) {
		for (const it of k.items) allKotItems.push({ item_id: it.item_id, quantity: it.quantity ?? 1 });
		// collect liquorShotUsages if present (these were created at KOT time)
		const kus = await prisma.liquorShotUsage.findMany({ where: { kot_id: k.id } });
		for (const su of kus) allShotUsages.push(su);
	}


	// aggregated sealed items (Map<item_id, qty>)
	const sealedMap = aggregateSealedItems(allKotItems);

	// aggregated shot usages -> Map key => { item_id, ml_used, count }

	const shotMap = aggregateShotUsages(allShotUsages);

	// Convert maps to item input array
	const itemsToBill: any[] = [];

	for (const [itemId, qty] of sealedMap.entries()) {
		itemsToBill.push({ item_id: itemId, quantity: qty });
	}

	// For shot map entries
	for (const [k, v] of shotMap.entries()) {
		itemsToBill.push({ item_id: v.item_id, quantity: v.count, shot_ml: v.ml_used });
	}

	// Append extra_items from payload if any
	if (payload.extra_items && payload.extra_items.length > 0) {
		for (const ei of payload.extra_items) itemsToBill.push(ei);
	}

	// Build CreateBillInput
	const billPayload: CreateBillInput = {
		table_no: kots[0].table_no,
		user_id: payload.user_id ?? kots[0].waiter_id ?? null,
		items: itemsToBill,
		payments: payload.payments,
		discount_flat: payload.discount_flat,
		discount_percent: payload.discount_percent,
		is_temp: payload.is_temp ?? false,
		zone: payload.zone ?? ""
	};

	// Call createBill (it handles ml deduction and batch consumption)
	const bill = await createBill(billPayload);

	// mark KOTs as CLOSED (only those that were served or used) — we will close served KOTs
	await prisma.kOT.updateMany({
		where: { id: { in: kots.map((x) => x.id) }, status: "SERVED" },
		data: { status: "CLOSED", updated_at: new Date(), bill_id: bill!.id }
	});

	await audit(payload.user_id ?? null, AuditEvent.BILL_CREATE_FROM_KOT, `Bill ${bill!.id} created from KOTs ${kots.map((x) => x.id).join(",")}`);

	return bill;
}

export async function addPaymentToBill(billId: number, payments: PaymentInput[], userId?: number) {
	const bill = await prisma.bill.findUnique({ where: { id: billId } });
	if (!bill) throw new Error("bill_not_found");

	// Expect payments to be final payment chunk. We'll allow partial payments but they must not overpay.
	return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		let paidSum = 0;
		for (const p of payments) {
			await tx.payment.create({
				data: {
					billId,
					method: (p.method as any),
					amount: p.amount,
					referenceNo: p.referenceNo ?? null
				}
			});
			paidSum += p.amount;
		}

		const agg = await tx.payment.aggregate({ where: { billId }, _sum: { amount: true } });
		const totalPaid = agg._sum.amount ?? 0;

		const outstanding = bill.total - bill.discount;

		if (Math.abs(totalPaid - outstanding) < 0.001) {
			await tx.bill.update({ where: { id: billId }, data: { status: "PAID" } });
			await finalizePaidBill(tx, { id: billId, table_no: bill.table_no });
		} else if (totalPaid > outstanding + 0.001) {
			throw new Error("overpayment_not_allowed");
		}

		return { ok: true, paid: totalPaid };
	}).then(async (res) => {
		await audit(userId ?? null, AuditEvent.BILL_ADD_PAYMENT, `Added payments to bill ${billId}`);
		return res;
	});
}

export async function getBill(id: number) {
	if (!id || id < 0) throw new Error("invalid_bill_id");
	return prisma.bill.findUnique({
		where: { id },
		include: {
			items: { include: { batches: true, shotUsage: true } },
			payments: true,
			kots: true
		}
	});
}

export async function rollbackBill(billId: number, userId?: number) {
	const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { items: { include: { batches: true } }, payments: true } });
	if (!bill) throw new Error("bill_not_found");

	await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		// restore batch qtys and create inverse stock movements
		for (const bi of bill.items) {
			const batches = await tx.billItemBatch.findMany({ where: { bill_item_id: bi.id } });
			for (const b of batches) {
				await tx.purchaseBatch.update({ where: { id: b.purchase_batch_id }, data: { qty_remaining: { increment: b.qty_used } } });

				await tx.stockMovement.create({
					data: {
						item_id: bi.item_id,
						change_qty: b.qty_used,
						reason: `Rollback bill ${billId} — restored batch ${b.purchase_batch_id}`,
						movement_type: "MANUAL_ADJUSTMENT",
						ref_id: billId,
						created_by: userId ?? null,
						purchaseBatchId: b.purchase_batch_id,
						created_at: new Date()
					}
				});
			}

			// restore non-batch item.stock
			const item = await tx.item.findUnique({ where: { id: bi.item_id } });
			if (item && item.manage_stock && !item.is_liquor) {
				await tx.item.update({ where: { id: item.id }, data: { stock: (item.stock ?? 0) + bi.quantity } });
				await tx.stockMovement.create({
					data: {
						item_id: item.id,
						change_qty: bi.quantity,
						reason: `Rollback bill ${billId} — restored stock`,
						movement_type: "MANUAL_ADJUSTMENT",
						ref_id: billId,
						created_by: userId ?? null,
						created_at: new Date()
					}
				});
			}
		}

		// restore shot usages -> add ml back to open bottles
		const shotUsages = await tx.liquorShotUsage.findMany({ where: { bill_item_id: { in: bill.items.map((x) => x.id) } } });
		for (const su of shotUsages) {
			const bottle = await tx.openLiquorBottle.findUnique({ where: { id: su.open_bottle_id } });
			if (!bottle) continue;
			await tx.openLiquorBottle.update({
				where: { id: bottle.id },
				data: {
					ml_remaining: bottle.ml_remaining + su.ml_used,
					status: "OPEN",
					closed_at: null
				}
			});
		}

		// delete billItemBatches, liquorShotUsage, billItems, payments, then mark bill cancelled
		await tx.billItemBatch.deleteMany({ where: { bill_item_id: { in: bill.items.map((x) => x.id) } } });
		await tx.liquorShotUsage.deleteMany({ where: { bill_item_id: { in: bill.items.map((x) => x.id) } } });
		await tx.billItem.deleteMany({ where: { bill_id: billId } });
		await tx.payment.deleteMany({ where: { billId } });
		await tx.bill.update({ where: { id: billId }, data: { status: "CANCELLED" } });
	});

	await audit(userId ?? null, AuditEvent.BILL_ROLLBACK, `Rolled back bill ${billId}`);
	return { ok: true };
}
