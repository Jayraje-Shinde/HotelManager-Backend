import prisma from "../../config/db";

export async function getBatchesByItem(itemId: number) {
	return prisma.purchaseBatch.findMany({
		where: { item_id: itemId },
		orderBy: { created_at: "asc" },     // FIFO sorted
		include: {
			purchase: true,
			item: true
		}
	});
}

export async function getBatchById(batchId: number) {
	return prisma.purchaseBatch.findUnique({
		where: { id: batchId },
		include: {
			purchase: true,
			item: true
		}
	});
}

export async function getAllBatches() {
	return prisma.purchaseBatch.findMany({
		orderBy: {
			id: "desc"
		},
		include: {
			purchase: true,
			item: true
		}
	});
}
