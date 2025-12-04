import prisma from "../../../config/db";

/*
 * waiterSales
 * - start?: string (yyyy-mm-dd)
 * - end?: string (yyyy-mm-dd)  (if start provided and end omitted -> end = today)
 * - waiterId?: number (optional, if provided returns single waiter summary inside array)
 *
 * Returns an array of waiter summaries:
 * [
 *  {
 *    waiter_id,
 *    waiter_name,
 *    bills_count,
 *    total_sales,
 *    total_items_qty,
 *    sealed_bottles_sold,
 *    total_ml_sold,
 *    avg_bill,
 *    payments: { CASH: 123, UPI: 45, ... }
 *  }
 * ]
 */
export async function waiterSales(start?: string, end?: string, waiterId?: number) {
	// Date handling: same rules as other reports
	if (!start && !end) {
		// all bills
		const bills = await prisma.bill.findMany({
			include: {
				user: true,
				items: { include: { item: true, batches: true, shotUsage: true } },
				payments: true
			},
			orderBy: { bill_date: "asc" }
		});
		return aggregateByWaiter(bills, waiterId);
	}

	if (start && !end) {
		end = new Date().toISOString().slice(0, 10);
	}

	if (!start && end) throw new Error("Start date required when end date is provided");

	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const bills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: from, lte: to },
			...(waiterId !== undefined && !Number.isNaN(waiterId) ? { user_id: waiterId } : {})
		},
		include: {
			user: true,
			items: { include: { item: true, batches: true, shotUsage: true } },
			payments: true
		},
		orderBy: { bill_date: "asc" }
	});

	return aggregateByWaiter(bills, waiterId);
}

function aggregateByWaiter(bills: any[], singleWaiterId?: number) {
	const map = new Map<number, any>();

	for (const b of bills) {
		const waiterId = b.user_id ?? 0; // 0 if unknown
		const waiterName = b.user?.name ?? "Unknown";

		if (singleWaiterId !== undefined && waiterId !== singleWaiterId) continue;

		if (!map.has(waiterId)) {
			map.set(waiterId, {
				waiter_id: waiterId,
				waiter_name: waiterName,
				bills_count: 0,
				total_sales: 0,
				total_items_qty: 0,
				sealed_bottles_sold: 0,
				total_ml_sold: 0,
				payments: {} as Record<string, number>
			});
		}

		const rec = map.get(waiterId);

		rec.bills_count += 1;
		rec.total_sales += Number(b.total ?? 0);
		// items qty and sealed bottles / ml
		for (const bi of b.items || []) {
			rec.total_items_qty += Number(bi.quantity ?? 0);

			// sealed bottles count: treat bill item with no shotUsage as sealed sale if item.is_liquor
			if (bi.item?.is_liquor) {
				const shotUsageCount = (bi.shotUsage && bi.shotUsage.length) || 0;
				if (shotUsageCount === 0) {
					rec.sealed_bottles_sold += Number(bi.quantity ?? 0);
				}
			}

			// ml sold from shotUsage attached to billitem
			if (bi.shotUsage && bi.shotUsage.length) {
				for (const s of bi.shotUsage) {
					rec.total_ml_sold += Number(s.ml_used ?? 0);
				}
			}
		}

		// payments breakdown
		for (const p of b.payments || []) {
			const method = String(p.method ?? "UNKNOWN");
			const amt = Number(p.amount ?? 0);
			rec.payments[method] = (rec.payments[method] || 0) + amt;
		}

		map.set(waiterId, rec);
	}

	// finalize avg_bill
	const result = [...map.values()].map(r => ({
		...r,
		avg_bill: r.bills_count > 0 ? +(r.total_sales / r.bills_count).toFixed(2) : 0
	}));

	// If a single waiter was requested but had no bills, return empty array
	if (singleWaiterId !== undefined && result.length === 0) return [];

	return result;
}
