// src/api/reports/kot/kot-cancelled.service.ts
import prisma from "../../../config/db";

export async function cancelledKOTReport(
	start?: string,
	end?: string,
	waiterId?: number,
	tableNo?: string
) {

	// CASE 1: no dates → all cancelled KOTs
	if (!start && !end) {
		const kots = await prisma.kOT.findMany({
			where: {
				status: "CANCELLED",
				...(waiterId !== undefined && !Number.isNaN(waiterId)
					? { waiter_id: waiterId }
					: {}),
				...(tableNo ? { table_no: tableNo } : {})
			},
			include: {
				waiter: true,
				items: { include: { item: true } }
			},
			orderBy: { updated_at: "asc" }
		});

		return formatCancelled(kots);
	}

	// CASE 2: start only → end = today
	if (start && !end) {
		end = new Date().toISOString().slice(0, 10);
	}

	// CASE 3: end only → invalid
	if (!start && end) throw new Error("Start date required when end date is provided");

	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const kots = await prisma.kOT.findMany({
		where: {
			status: "CANCELLED",
			updated_at: { gte: from, lte: to },
			...(waiterId !== undefined && !Number.isNaN(waiterId)
				? { waiter_id: waiterId }
				: {}),
			...(tableNo ? { table_no: tableNo } : {})
		},
		include: {
			waiter: true,
			items: { include: { item: true } }
		},
		orderBy: { updated_at: "asc" }
	});

	return formatCancelled(kots);
}

// FORMATTER
function formatCancelled(kots: any[]) {
	return kots.map(k => ({
		kot_id: k.id,
		kot_no: k.kot_no,
		table_no: k.table_no,
		waiter_name: k.waiter?.name ?? null,
		waiter_id: k.waiter_id,
		status: k.status,
		cancelled_at: k.updated_at,

		items: k.items.map((it: any) => ({
			item_id: it.item_id,
			item_name: it.item.name,
			quantity: it.quantity,
			note: it.note ?? ""
		}))
	}));
}
