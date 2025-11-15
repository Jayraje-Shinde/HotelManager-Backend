import prisma from "../config/db";

export async function recordStockMovement(
	item_id: number,
	change_qty: number,
	reason: string,
	ref_type?: string,
	ref_id?: number,
	created_by?: number
) {
	const item = await prisma.item.findUnique({ where: { id: item_id } });
	if (!item) throw new Error(`Item with id ${item_id} not found`);

	const newStock = (item.stock ?? 0) + change_qty;

	// Update stock
	await prisma.item.update({
		where: { id: item_id },
		data: { stock: newStock },
	});

	// Log movement
	await prisma.stockMovement.create({
		data: {
			item_id,
			change_qty,
			reason,
			ref_type,
			ref_id,
			created_by,
		},
	});
}
