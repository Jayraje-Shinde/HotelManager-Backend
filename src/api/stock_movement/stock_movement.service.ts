import prisma from "../../config/db";
import { Stock_movementType } from "../../types/stock_movement";
import { update } from "../users/user.service";

export async function recordMovement(data: Stock_movementType) {
	const item = await prisma.item.findUnique({ where: { id: data.item_id } });
	if (!item) throw new Error("Item Not Found");

	//create new stock entry 
	const movement = await prisma.stockMovement.create({
		data: {
			item_id: data.item_id,
			change_qty: data.change_qty,
			reason: data.reason,
			ref_type: data.ref_type ?? null,
			ref_id: data.ref_id ?? null,
			created_by: data.created_by ?? null
		}
	});

	const newStock = (item.stock ?? 0) + data.change_qty;
	await prisma.item.update({
		where: { id: data.item_id },
		data: { stock: newStock }
	});

	return { message: "Stock Movement Recorded Successfully" };
}


export async function getAll() {
	return prisma.stockMovement.findMany({
		include: { item: true, user: true },
		orderBy: { created_at: "desc" }
	});
}


export async function getByItem(item_id: number) {
	return prisma.stockMovement.findMany({
		where: { id: item_id },
		include: { item: true, user: true },
		orderBy: { created_at: "desc" }
	})
}