// src/api/reports/kot/kot-report.service.ts
import prisma from "../../../config/db";

export async function kotReport(
	start?: string,
	end?: string,
	waiterId?: number,
	tableNo?: string
) {

	// CASE 1: no start/end → all KOTs
	if (!start && !end) {
		const kots = await prisma.kOT.findMany({
			where: {
				...(waiterId !== undefined && !Number.isNaN(waiterId)
					? { waiter_id: waiterId }
					: {}),
				...(tableNo ? { table_no: tableNo } : {})
			},
			include: {
				waiter: true,
				items: { include: { item: true } }
			},
			orderBy: { created_at: "asc" }
		});

		return formatKot(kots);
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
			created_at: { gte: from, lte: to },
			...(waiterId !== undefined && !Number.isNaN(waiterId)
				? { waiter_id: waiterId }
				: {}),
			...(tableNo ? { table_no: tableNo } : {})
		},
		include: {
			waiter: true,
			items: { include: { item: true } }
		},
		orderBy: { created_at: "asc" }
	});

	return formatKot(kots);
}

// FORMATTER
function formatKot(kots: any[]) {
	return kots.map(k => ({
		kot_id: k.id,
		kot_no: k.kot_no,
		table_no: k.table_no,
		waiter_name: k.waiter?.name ?? null,
		waiter_id: k.waiter_id,
		status: k.status,
		created_at: k.created_at,
		updated_at: k.updated_at,

		items: k.items.map((it: any) => ({
			item_id: it.item_id,
			item_name: it.item.name,
			quantity: it.quantity,
			note: it.note ?? ""
		}))
	}));
}
