// src/utils/bottleUtils.ts
import prisma from "../config/db";
import { TxClient } from "../types/txClient";

/**
 * Helper utilities for open bottle handling.
 * These functions are designed to be used inside a Prisma transaction (tx).
 *
 * NOTE: These helpers do NOT call audit(). They return lists of bottles that
 * need auditing so caller can do audit AFTER tx commits.
 */

export type Tx = typeof prisma;

export async function findOpenBottleForItem(tx: TxClient, itemId: number) {
	return tx.openLiquorBottle.findFirst({
		where: { item_id: itemId, status: "OPEN", ml_remaining: { gt: 0 } },
		orderBy: { opened_at: "asc" }
	});
}

/**
 * Deduct `ml` from the given open bottle (tx version).
 * Returns { newMlRemaining, finished:boolean }.
 */
export async function deductMlFromOpenBottleTx(
	tx: TxClient,
	openBottleId: number,
	ml: number
): Promise<{ newMl: number; finished: boolean }> {
	const bottle = await tx.openLiquorBottle.findUnique({ where: { id: openBottleId } });
	if (!bottle) throw new Error("open_bottle_not_found");

	if (bottle.ml_remaining < ml) throw new Error("insufficient_ml_in_bottle");

	const newMl = bottle.ml_remaining - ml;
	const finished = newMl === 0;

	await tx.openLiquorBottle.update({
		where: { id: openBottleId },
		data: {
			ml_remaining: newMl,
			status: finished ? "FINISHED" : bottle.status,
			closed_at: finished ? new Date() : null
		}
	});

	return { newMl, finished };
}

/**
 * Try to consume `qty` sealed bottles using FIFO purchase batches (tx version).
 * Returns array of { batchId, usedQty, cost_price } entries used to create BillItemBatch rows.
 */
export async function consumeSealedBottlesBatchesTx(
	tx: TxClient,
	itemId: number,
	qtyToConsume: number
): Promise<Array<{ purchase_batch_id: number; qty_used: number; cost_price: number }>> {
	let remaining = qtyToConsume;
	const used: Array<{ purchase_batch_id: number; qty_used: number; cost_price: number }> = [];

	while (remaining > 0) {
		const nextBatch = await tx.purchaseBatch.findFirst({
			where: { item_id: itemId, qty_remaining: { gt: 0 } },
			orderBy: { created_at: "asc" }
		});

		if (!nextBatch) throw new Error("NO_STOCK");

		const take = Math.min(remaining, nextBatch.qty_remaining);

		// update batch
		await tx.purchaseBatch.update({
			where: { id: nextBatch.id },
			data: { qty_remaining: nextBatch.qty_remaining - take }
		});

		used.push({
			purchase_batch_id: nextBatch.id,
			qty_used: take,
			cost_price: nextBatch.cost_price
		});

		remaining -= take;
	}

	return used;
}
