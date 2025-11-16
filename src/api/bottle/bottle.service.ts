import prisma from "../../config/db";
import { BreakBottleType } from "../../types/openBottle";

/**
 * Break a bottle:
 * - find FIFO batch (qty_remaining > 0)
 * - decrement batch qty_remaining
 * - reduce item stock
 * - create OpenLiquorBottle (ml_remaining = item.ml_per_unit)
 * - create StockMovement (OPEN_BOTTLE)
 */
export async function breakBottle(data: BreakBottleType) {
	const { item_id, user_id } = data;

	// get item (must be liquor)
	const item = await prisma.item.findUnique({ where: { id: item_id } });
	if (!item) throw new Error("Item not found");
	if (!item.is_liquor) throw new Error("Only liquor items can be broken");

	if (!item.ml_per_unit) {
		throw new Error("Liquor item does not have ml_per_unit defined");
	}

	// find FIFO batch
	const batch = await prisma.purchaseBatch.findFirst({
		where: {
			item_id: item_id,
			qty_remaining: { gt: 0 }
		},
		orderBy: { created_at: "asc" }
	});

	if (!batch) {
		throw new Error("No stock available to break bottle");
	}

	// transaction: update batch, stock, movement, create bottle
	const result = await prisma.$transaction(async (tx) => {
		// 1. Update batch qty_remaining
		const updatedBatch = await tx.purchaseBatch.update({
			where: { id: batch.id },
			data: { qty_remaining: batch.qty_remaining - 1 }
		});

		// 2. Reduce item stock by 1
		await tx.item.update({
			where: { id: item_id },
			data: { stock: (item.stock ?? 0) - 1 }
		});

		// 3. Create OpenLiquorBottle
		const openBottle = await tx.openLiquorBottle.create({
			data: {
				item_id,
				ml_remaining: item.ml_per_unit ?? 0, // full bottle ml
				status: "OPEN",
				batch_id: batch.id
			}
		});

		// 4. Create StockMovement
		await tx.stockMovement.create({
			data: {
				item_id,
				change_qty: -1,
				reason: `Bottle opened (Batch ${batch.id})`,
				movement_type: "OPEN_BOTTLE",
				ref_id: updatedBatch.purchase_id,
				created_by: user_id ?? null,
				created_at: new Date()
			}
		});

		return {
			openBottle,
			batch: updatedBatch,
			item
		};
	});

	return result;
}

/** Get all open bottles */
export async function getOpenBottles() {
	return prisma.openLiquorBottle.findMany({
		where: { status: "OPEN" },
		include: { item: true }
	});
}

/** Close bottle manually (rarely used) */
export async function closeBottle(id: number, breakage = false, reason?: string) {
	return prisma.openLiquorBottle.update({
		where: { id },
		data: {
			status: breakage ? "BREAKAGE" : "CLOSED",
			breakage: breakage,
			breakage_reason: reason ?? null,
			closed_at: new Date()
		}
	});
}
