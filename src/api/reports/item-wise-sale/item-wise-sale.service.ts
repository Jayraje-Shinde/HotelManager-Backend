import prisma from "../../../config/db";

export async function itemWiseSales(
	start?: string,
	end?: string,
	itemId?: number,
	categoryId?: number,
	search?: string
) {
	// CASE 1: no dates → fetch all
	if (!start && !end) {
		const bills = await prisma.bill.findMany({
			include: {
				items: {
					include: { item: true, batches: true, shotUsage: true }
				}
			},
			orderBy: { bill_date: "asc" }
		});
		return computeFromBills(bills, itemId, categoryId, search);
	}

	// CASE 2: start only → end=today
	if (start && !end) {
		end = new Date().toISOString().slice(0, 10);
	}

	// CASE 3: end only → invalid
	if (!start && end) {
		throw new Error("Start date required when end date is provided");
	}

	// Normal flow
	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const bills = await prisma.bill.findMany({
		where: { bill_date: { gte: from, lte: to } },
		include: {
			items: {
				include: { item: true, batches: true, shotUsage: true }
			}
		},
		orderBy: { bill_date: "asc" }
	});

	return computeFromBills(bills, itemId, categoryId, search);
}


// -----------------------------------------------------------------------
// Core logic to compute summary PER item_id
// -----------------------------------------------------------------------
function computeFromBills(bills: any[], itemId?: number, categoryId?: number, search?: string) {
	const map = new Map<number, any>();

	for (const b of bills) {
		for (const bi of b.items) {
			const itm = bi.item;
			if (itemId && itm.id !== itemId) continue;
			if (categoryId && itm.category_id !== categoryId) continue;
			if (search && !itm.name.toLowerCase().includes(search.toLowerCase())) continue;

			if (!map.has(itm.id)) {
				map.set(itm.id, {
					item_id: itm.id,
					name: itm.name,
					category_id: itm.category_id,
					is_liquor: itm.is_liquor,
					unit: itm.unit_id,
					ml_per_unit: itm.ml_per_unit ?? null,

					// aggregates
					qty_sold: 0,
					sealed_bottles_sold: 0,
					ml_sold: 0,
					shot_count: 0,
					revenue: 0,
					cogs: 0,

					batches_used: []
				});
			}

			const rec = map.get(itm.id);

			// quantity sold
			rec.qty_sold += bi.quantity;
			rec.revenue += bi.subtotal;

			// sealed bottles (liquor sealed sale)
			if (itm.is_liquor && !bi.shotUsage.length) {
				rec.sealed_bottles_sold += bi.quantity;
			}

			// shots / ml sold
			let itemMl = 0;
			for (const s of bi.shotUsage) {
				itemMl += s.ml_used;
			}
			rec.ml_sold += itemMl;
			rec.shot_count += bi.shotUsage.length;

			// COGS calculation from batches
			for (const bb of bi.batches) {
				rec.cogs += bb.qty_used * bb.cost_price_at_use;
				rec.batches_used.push({
					batch_id: bb.purchase_batch_id,
					qty_used: bb.qty_used,
					ml_used: bb.ml_used,
					cost_price: bb.cost_price_at_use
				});
			}

			map.set(itm.id, rec);
		}
	}

	// Convert map to array + compute margin
	return [...map.values()].map(r => ({
		...r,
		margin: r.revenue - r.cogs
	}));
}
