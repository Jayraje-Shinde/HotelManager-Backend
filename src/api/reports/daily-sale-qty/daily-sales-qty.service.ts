import prisma from "../../../config/db";

export async function dailySalesQty(start?: string, end?: string) {

	// CASE 1 — no dates → all bills
	if (!start && !end) {
		const bills = await prisma.bill.findMany({
			include: {
				items: {
					include: { item: true, shotUsage: true }
				}
			},
			orderBy: { bill_date: "asc" }
		});
		return groupByDay(bills);
	}

	// CASE 2 — start only → end = today
	if (start && !end) {
		end = new Date().toISOString().slice(0, 10);
	}

	// CASE 3 — end only → invalid
	if (!start && end) throw new Error("Start date required when end date is provided");

	// CASE 4 — proper range
	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const bills = await prisma.bill.findMany({
		where: { bill_date: { gte: from, lte: to } },
		include: {
			items: {
				include: { item: true, shotUsage: true }
			}
		},
		orderBy: { bill_date: "asc" }
	});

	return groupByDay(bills);
}

// ---------------------------------------------
// GROUP LOGIC
// ---------------------------------------------
function groupByDay(bills: any[]) {
	const dayMap = new Map<string, any>();

	for (const b of bills) {
		const day = b.bill_date.toISOString().slice(0, 10);

		if (!dayMap.has(day)) {
			dayMap.set(day, new Map<number, any>());
		}

		const itemMap = dayMap.get(day);

		for (const bi of b.items) {
			const itm = bi.item;
			if (!itm) continue;

			if (!itemMap.has(itm.id)) {
				itemMap.set(itm.id, {
					item_id: itm.id,
					name: itm.name,
					is_liquor: itm.is_liquor,
					ml_per_unit: itm.ml_per_unit ?? null,
					qty_sold: 0,
					sealed_bottles_sold: 0,
					shot_count: 0,
					ml_sold: 0,
					revenue: 0
				});
			}

			const rec = itemMap.get(itm.id);

			// quantity sold (food + liquor)
			rec.qty_sold += Number(bi.quantity ?? 0);

			// sealed bottles
			if (itm.is_liquor && (!bi.shotUsage || bi.shotUsage.length === 0)) {
				rec.sealed_bottles_sold += Number(bi.quantity ?? 0);
			}

			// shots / ml sold
			if (bi.shotUsage && bi.shotUsage.length) {
				rec.shot_count += bi.shotUsage.length;
				for (const s of bi.shotUsage) {
					rec.ml_sold += Number(s.ml_used ?? 0);
				}
			}

			// revenue
			rec.revenue += Number(bi.subtotal ?? 0);

			itemMap.set(itm.id, rec);
		}
	}

	// Convert map → array
	const finalOutput: any[] = [];

	for (const [day, itemMap] of dayMap.entries()) {
		finalOutput.push({
			date: day,
			items: [...itemMap.values()]
		});
	}

	return finalOutput;
}
