import prisma from "../../config/db";

export async function query(where: any) {
	if (!where) throw new Error("no WHERE object found");

	const items = await prisma.item.findMany({
		where,
		include: {
			category: true,
			unit: true,
			purchaseBatches: {
				where: { qty_remaining: { gt: 0 } },
				select: {
					id: true,
					qty_remaining: true,
					cost_price: true
				}
			}
		}
	});

	const output = items.map(i => {
		const total_value = i.purchaseBatches.reduce(
			(sum, batch) => sum + batch.qty_remaining * batch.cost_price,
			0
		);

		const total_qty_remaining = i.purchaseBatches.reduce(
			(sum, batch) => sum + batch.qty_remaining,
			0
		);

		return {
			id: i.id,
			name: i.name,
			category: i.category.name,
			is_liquor: i.is_liquor,
			stock: i.stock ?? 0,
			unit: i.unit.name,
			total_qty_remaining,
			total_value,
			batch_details: i.purchaseBatches
		};
	});

	return output;

}