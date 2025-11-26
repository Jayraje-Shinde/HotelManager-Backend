import prisma from "../../config/db";
import crypto from "crypto";

function normalizeDate(dateStr: string) {
	const d = new Date(dateStr + "T00:00:00");
	d.setHours(0, 0, 0, 0);
	return d;
}

async function acquireLock(date: string) {
	const hash = crypto.createHash("sha256").update(date).digest().readUInt32BE(0);
	await prisma.$executeRawUnsafe(`SELECT pg_advisory_lock(${hash});`);
}

async function releaseLock(date: string) {
	const hash = crypto.createHash("sha256").update(date).digest().readUInt32BE(0);
	await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(${hash});`);
}

// ----------------------
// CLOSE DAY
// ----------------------
export async function closeDay(data: {
	business_date: string;
	userId: number;
	forceClose?: boolean;
	note?: string;
}) {
	const { business_date, userId, forceClose = false, note = "" } = data;

	const date = normalizeDate(business_date);
	const start = new Date(date);
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);

	await acquireLock(business_date);

	try {
		// already closed?
		const existing = await prisma.dayClosing.findUnique({ where: { business_date: start } });
		if (existing && existing.status === "CLOSED") {
			throw new Error("Day already closed");
		}

		// VALIDATION CHECKS
		const openBills = await prisma.bill.count({
			where: { bill_date: { gte: start, lte: end }, status: { not: "PAID" } }
		});

		const openKots = await prisma.kOT.count({
			where: { created_at: { gte: start, lte: end }, status: { not: "CLOSED" } }
		});

		const errors: any = [];
		if (openBills > 0 && !forceClose) errors.push(`${openBills} open bills exist`);
		if (openKots > 0 && !forceClose) errors.push(`${openKots} open KOTs exist`);

		if (errors.length > 0) {
			throw new Error(errors.join(" | "));
		}

		// SNAPSHOT PROCESS
		const result = await prisma.$transaction(async (tx) => {
			const dc = await tx.dayClosing.create({
				data: {
					business_date: start,
					closed_by: userId,
					status: "OPENING",
					note
				}
			});

			// SALES SNAPSHOT
			const bills = await tx.bill.findMany({
				where: { bill_date: { gte: start, lte: end } }
			});

			for (const b of bills) {
				await tx.daySalesSnapshot.create({
					data: {
						day_closing_id: dc.id,
						bill_id: b.id,
						bill_no: String(b.id),
						bill_date: b.bill_date,
						user_id: b.user_id,
						table_no: b.table_no,
						total: b.total,
						discount: b.discount,
						status: b.status
					}
				});
			}

			// PAYMENT SNAPSHOT
			const payments = await tx.payment.findMany({
				where: { created_at: { gte: start, lte: end } }
			});

			for (const p of payments) {
				await tx.dayPaymentSnapshot.create({
					data: {
						day_closing_id: dc.id,
						bill_id: p.billId,
						method: p.method,
						amount: p.amount,
						referenceNo: p.referenceNo
					}
				});
			}

			// STOCK SNAPSHOT (used raw sql for faster query)
			const stock = await tx.$queryRawUnsafe(`
                SELECT "item_id",
                       SUM(qty_remaining) AS total_qty,
                       SUM(qty_remaining * cost_price) AS total_value
                FROM "PurchaseBatch"
                WHERE qty_remaining > 0
                GROUP BY "item_id";
            `);

			for (const s of stock as any[]) {
				await tx.dayStockSnapshot.create({
					data: {
						day_closing_id: dc.id,
						item_id: Number(s.item_id),
						stock_snapshot: Number(s.total_qty),
						total_value: Number(s.total_value)
					}
				});
			}

			// KOT SNAPSHOT
			const kots = await tx.kOT.findMany({
				where: { created_at: { gte: start, lte: end } }
			});

			for (const k of kots) {
				await tx.dayKOTSnapshot.create({
					data: {
						day_closing_id: dc.id,
						kot_id: k.id,
						waiter_id: k.waiter_id,
						table_no: k.table_no,
						status: k.status
					}
				});
			}

			// TOTALS
			const totalSales = bills.reduce((sum, b) => sum + Number(b.total || 0), 0);
			const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
			const totalStockValue = (stock as any[]).reduce(
				(sum, r) => sum + Number(r.total_value || 0),
				0
			);

			await tx.dayClosing.update({
				where: { id: dc.id },
				data: {
					total_sales: totalSales,
					total_payments: totalPayments,
					total_stock_value: totalStockValue,
					status: "CLOSED"
				}
			});

			return dc;
		});

		return result;
	} finally {
		await releaseLock(business_date);
	}
}

// ----------------------
// REOPEN DAY
// ----------------------
export async function reopenDay(business_date: string, adminId: number, reason: string) {
	const date = normalizeDate(business_date);

	const exists = await prisma.dayClosing.findUnique({ where: { business_date: date } });
	if (!exists) throw new Error("Day not closed");

	return prisma.dayClosing.update({
		where: { business_date: date },
		data: {
			status: "OPEN",
			reopen_allowed: true,
			reopen_by: adminId,
			reopen_at: new Date(),
			note: `Reopened: ${reason}`
		}
	});
}

// ----------------------
// GET DAY SNAPSHOT
// ----------------------
export async function getDayEnd(date: string) {
	const d = normalizeDate(date);

	const data = await prisma.dayClosing.findUnique({
		where: { business_date: d },
		include: {
			salesSnapshots: true,
			paymentSnapshots: true,
			stockSnapshots: true,
			liquorSnapshots: true,
			kotSnapshots: true
		}
	});

	if (!data) throw new Error("Day-End not found");

	return data;
}
