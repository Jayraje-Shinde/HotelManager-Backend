// src/api/billing/billing.utils.ts

import prisma from "../../config/db";

// -------------------------------
// Number helpers
// -------------------------------
export function round2(num: number): number {
	return Math.round(num * 100) / 100;
}

// -------------------------------
// Discount helper
// -------------------------------
export function applyDiscount(
	total: number,
	discount_flat?: number | null,
	discount_percent?: number | null
): number {
	if (discount_flat != null && discount_percent != null)
		throw new Error("only_one_discount_allowed");

	if (discount_flat != null) {
		return Math.max(0, round2(total - discount_flat));
	}

	if (discount_percent != null) {
		return round2(total - (total * discount_percent) / 100);
	}

	return round2(total);
}

// -------------------------------
// Price helper for SHOTS
// ml_per_unit + selling_price determines the per-ml cost
// -------------------------------
export function getShotRate(item: any, mlUsed: number): number {
	if (!item) return 0;

	if (item.ml_per_unit && item.selling_price != null && item.ml_per_unit > 0) {
		const perMl = item.selling_price / item.ml_per_unit;
		return round2(perMl * mlUsed);
	}

	// fallback for loose logic
	return item.selling_price ?? 0;
}

// -------------------------------
// KOT → Bill item conversion helpers
// -------------------------------

/**
 * Build sealed liquor + non-liquor aggregated quantities.
 * Example:
 * KOTItem { item_id: 5, qty: 2 }
 * KOTItem { item_id: 5, qty: 1 }
 * => sealedMap: {5 => 3}
 */
export function aggregateSealedItems(kotItems: any[]) {
	const sealedMap = new Map<number, number>();

	for (const ki of kotItems) {
		const prev = sealedMap.get(ki.item_id) ?? 0;
		sealedMap.set(ki.item_id, prev + (ki.quantity ?? 0));
	}

	return sealedMap;
}

/**
 * Group shot usages by (item_id, ml_used)
 * Example:
 * Royal Stag 30ml → 3 shots
 * Royal Stag 60ml → 1 shot
 * Output:
 * {
 *   "1|30": { item_id: 1, ml_used: 30, count: 3 }
 *   "1|60": { item_id: 1, ml_used: 60, count: 1 }
 * }
 */
export function aggregateShotUsages(shotUsages: any[]) {
	const shotMap = new Map<
		string,
		{ item_id: number; ml_used: number; count: number }
	>();

	for (const su of shotUsages) {
		if (!su.openBottle) throw new Error("openBottle_missing_in_shot_usage");

		const itemId = su.openBottle.item_id;
		const ml = su.ml_used;
		const key = `${itemId}|${ml}`;

		const curr = shotMap.get(key);
		if (!curr) {
			shotMap.set(key, { item_id: itemId, ml_used: ml, count: 1 });
		} else {
			curr.count += 1;
		}
	}

	return shotMap;
}

// -------------------------------
// FIFO Consumption (sealed liquor)
// -------------------------------

/**
 * Consume sealed bottles FIFO from PurchaseBatch.
 * Creates BillItemBatch + StockMovement entries.
 * Returns total cost of consumed batches.
 */
export async function consumeBatchesFIFO(
	tx: any,
	billItemId: number,
	itemId: number,
	qtyToSell: number,
	billId: number,
	userId?: number | null
) {
	let remaining = qtyToSell;

	while (remaining > 0) {
		const nextBatch = await tx.purchaseBatch.findFirst({
			where: { item_id: itemId, qty_remaining: { gt: 0 } },
			orderBy: { created_at: "asc" },
		});

		if (!nextBatch) {
			throw new Error(`NO_STOCK_FOR_ITEM_${itemId}`);
		}

		const consumeQty = Math.min(remaining, nextBatch.qty_remaining);

		// Reduce batch qty_remaining
		const updated = await tx.purchaseBatch.update({
			where: { id: nextBatch.id },
			data: { qty_remaining: nextBatch.qty_remaining - consumeQty },
		});

		// Write COGS batch entry
		await tx.billItemBatch.create({
			data: {
				bill_item_id: billItemId,
				purchase_batch_id: nextBatch.id,
				qty_used: consumeQty,
				ml_used: null,
				cost_price_at_use: nextBatch.cost_price,
			},
		});

		// Stock movement
		await tx.stockMovement.create({
			data: {
				item_id: itemId,
				change_qty: -consumeQty,
				reason: `Sale Bill ${billId}`,
				movement_type: "SALE",
				ref_id: billId,
				created_by: userId ?? null,
				created_at: new Date(),
				purchaseBatchId: nextBatch.id,
			},
		});

		remaining -= consumeQty;
	}
}

// -------------------------------
// Liquor Shot Linking
// -------------------------------
export async function linkShotUsagesToBillItem(
	tx: any,
	billItemId: number,
	kotIds: number[],
	itemId: number,
	ml: number
) {
	// Find shot usages matching these KOTs and ml amounts
	await tx.liquorShotUsage.updateMany({
		where: {
			kot_id: { in: kotIds },
			ml_used: ml,
			bill_item_id: null,
			openBottle: {
				item_id: itemId,
			},
		},
		data: {
			bill_item_id: billItemId,
		}
	});
}

// -------------------------------
// Table and KOT finalizers
// -------------------------------
export async function finalizePaidBill(tx: any, bill: any) {
	// Close served KOTs
	await tx.kOT.updateMany({
		where: { bill_id: bill.id, status: "SERVED" },
		data: { status: "CLOSED", updated_at: new Date() },
	});

	// Set table vacant
	await tx.tableStatus.upsert({
		where: { table_no: bill.table_no },
		update: { status: "VACANT", current_bill_id: bill.id },
		create: { table_no: bill.table_no, zone: "", status: "VACANT", current_bill_id: bill.id },
	});
}

export async function markTableOccupied(tx: any, table_no: string, billId: number) {
	await tx.tableStatus.upsert({
		where: { table_no },
		update: { status: "OCCUPIED", current_bill_id: billId },
		create: { table_no, zone: "", status: "OCCUPIED", current_bill_id: billId }
	});
}
