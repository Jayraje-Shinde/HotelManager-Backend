import prisma from "../../config/db";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

// ----------------------
// HELPERS
// ----------------------

function normalizeDate(dateStr: string) {
	const d = new Date(dateStr + "T00:00:00");
	d.setHours(0, 0, 0, 0);
	return d;
}

function getDayRange(dateStr: string) {
	const start = normalizeDate(dateStr);
	const end = new Date(start);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

async function acquireLock(date: string) {
	const hash = crypto.createHash("sha256").update(date).digest().readUInt32BE(0);
	await prisma.$executeRaw`SELECT pg_advisory_lock(${hash})`;
}

async function releaseLock(date: string) {
	const hash = crypto.createHash("sha256").update(date).digest().readUInt32BE(0);
	await prisma.$executeRaw`SELECT pg_advisory_unlock(${hash})`;
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
	const { start, end } = getDayRange(business_date);

	await acquireLock(business_date);

	try {
		// Already closed?
		const existing = await prisma.dayClosing.findUnique({ where: { business_date: start } });
		if (existing && existing.status === "CLOSED") {
			throw new Error("Day already closed");
		}

		// VALIDATION - only block on truly open/active bills and KOTs, not cancelled ones
		const openBills = await prisma.bill.count({
			where: {
				bill_date: { gte: start, lte: end },
				status: { in: ["OPEN", "CLOSED"] } // CLOSED = finalized but not yet paid
			}
		});

		const openKots = await prisma.kOT.count({
			where: {
				created_at: { gte: start, lte: end },
				status: { in: ["OPEN", "SENT", "SERVED"] } // excludes CLOSED and CANCELLED
			}
		});

		const errors: string[] = [];
		if (openBills > 0 && !forceClose) errors.push(`${openBills} unpaid bills exist`);
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

			if (bills.length > 0) {
				await tx.daySalesSnapshot.createMany({
					data: bills.map((b) => ({
						day_closing_id: dc.id,
						bill_id: b.id,
						bill_no: String(b.id),
						bill_date: b.bill_date,
						user_id: b.user_id,
						table_no: b.table_no,
						total: b.total,
						discount: b.discount,
						status: b.status
					}))
				});
			}

			// PAYMENT SNAPSHOT
			const payments = await tx.payment.findMany({
				where: { created_at: { gte: start, lte: end } }
			});

			if (payments.length > 0) {
				await tx.dayPaymentSnapshot.createMany({
					data: payments.map((p) => ({
						day_closing_id: dc.id,
						bill_id: p.billId,
						method: p.method,
						amount: p.amount,
						referenceNo: p.referenceNo
					}))
				});
			}

			// STOCK SNAPSHOT
			const stock: Array<{ item_id: bigint; total_qty: number; total_value: number }> =
				await tx.$queryRaw`
					SELECT item_id,
					       SUM(qty_remaining)::float AS total_qty,
					       SUM(qty_remaining * cost_price)::float AS total_value
					FROM "PurchaseBatch"
					WHERE qty_remaining > 0
					GROUP BY item_id
				`;

			if (stock.length > 0) {
				await tx.dayStockSnapshot.createMany({
					data: stock.map((s) => ({
						day_closing_id: dc.id,
						item_id: Number(s.item_id),
						stock_snapshot: Number(s.total_qty),
						total_value: Number(s.total_value)
					}))
				});
			}

			// KOT SNAPSHOT
			const kots = await tx.kOT.findMany({
				where: { created_at: { gte: start, lte: end } }
			});

			if (kots.length > 0) {
				await tx.dayKOTSnapshot.createMany({
					data: kots.map((k) => ({
						day_closing_id: dc.id,
						kot_id: k.id,
						waiter_id: k.waiter_id,
						table_no: k.table_no,
						status: k.status
					}))
				});
			}

			// LIQUOR SNAPSHOT
			await computeLiquorSnapshots(tx, start, end, dc.id);

			// TOTALS — only count PAID bills as actual sales
			const totalSales = bills
				.filter((b) => b.status === "PAID")
				.reduce((sum, b) => sum + Number(b.total || 0), 0);

			const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

			const totalStockValue = stock.reduce(
				(sum, r) => sum + Number(r.total_value || 0),
				0
			);

			await tx.dayClosing.update({
				where: { id: dc.id },
				data: {
					total_sales: totalSales,
					total_payments: totalPayments,
					total_stock_value: totalStockValue,
					open_kots_count: openKots,
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
	if (!exists) throw new Error("Day not found");
	if (exists.status !== "CLOSED") throw new Error("Day is not closed");

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
			stockSnapshots: {
				include: {
					item: { select: { id: true, name: true, is_liquor: true } }
				}
			},
			liquorSnapshots: {
				include: {
					item: { select: { id: true, name: true, ml_per_unit: true } }
				}
			},
			kotSnapshots: true
		}
	});

	if (!data) throw new Error("Day-End record not found for this date");

	return data;
}

// ----------------------
// PRECHECK
// ----------------------
export async function getPrecheck(business_date: string) {
	if (!business_date) throw new Error("business_date required");

	const { start, end } = getDayRange(business_date);

	// 1. Unpaid bills
	const openBills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: start, lte: end },
			status: { in: ["OPEN", "CLOSED"] }
		},
		select: { id: true, table_no: true, total: true, status: true }
	});

	// 2. Open KOTs
	const openKots = await prisma.kOT.findMany({
		where: {
			created_at: { gte: start, lte: end },
			status: { in: ["OPEN", "SENT", "SERVED"] }
		},
		select: { id: true, table_no: true, status: true, waiter_id: true }
	});

	// 3. Open liquor bottles
	const openBottles = await prisma.openLiquorBottle.findMany({
		where: {
			opened_at: { lte: end },
			status: "OPEN"
		},
		select: {
			id: true,
			item_id: true,
			ml_remaining: true,
			item: { select: { name: true, ml_per_unit: true } }
		}
	});

	// 4. Items with negative stock
	const negativeStock = await prisma.item.findMany({
		where: { stock: { lt: 0 } },
		select: { id: true, name: true, stock: true }
	});

	// 5. Liquor items missing ml_per_unit config
	const liquorErrors = await prisma.item.findMany({
		where: {
			is_liquor: true,
			OR: [{ ml_per_unit: null }, { ml_per_unit: { equals: 0 } }]
		},
		select: { id: true, name: true, ml_per_unit: true }
	});

	// 6. Open bottles where ml_remaining > bottle size (data integrity)
	const overflowBottles: Array<{
		id: bigint;
		item_id: bigint;
		ml_remaining: number;
		ml_per_unit: number;
		name: string;
	}> = await prisma.$queryRaw`
		SELECT ob.id, ob.item_id, ob.ml_remaining, i.ml_per_unit, i.name
		FROM "OpenLiquorBottle" ob
		JOIN "Item" i ON i.id = ob.item_id
		WHERE ob.ml_remaining > COALESCE(i.ml_per_unit, 0)
	`;

	// 7. Payment mismatch on PAID bills
	const paymentMismatch: Array<{
		id: bigint;
		total: number;
		paid: number;
	}> = await prisma.$queryRaw`
		SELECT b.id, b.total, COALESCE(SUM(p.amount), 0)::float AS paid
		FROM "Bill" b
		LEFT JOIN "Payment" p ON p."billId" = b.id
		WHERE b.bill_date BETWEEN ${start} AND ${end}
		  AND b.status = 'PAID'
		GROUP BY b.id
		HAVING ABS(COALESCE(SUM(p.amount), 0) - (b.total - COALESCE(b.discount, 0))) > 0.01
	`;

	return {
		date: business_date,
		can_close: openBills.length === 0 && openKots.length === 0,

		open_bills_count: openBills.length,
		open_kots_count: openKots.length,
		open_bottles_count: openBottles.length,
		negative_stock_count: negativeStock.length,

		open_bills: openBills,
		open_kots: openKots,
		open_bottles: openBottles,
		negative_stock: negativeStock,

		warnings: {
			liquor_items_missing_ml: liquorErrors,
			bottles_with_overflow_ml: overflowBottles.map((r) => ({
				...r,
				id: Number(r.id),
				item_id: Number(r.item_id)
			})),
			payment_mismatch: paymentMismatch.map((r) => ({
				...r,
				id: Number(r.id)
			}))
		}
	};
}

// ----------------------
// LIQUOR SNAPSHOTS (internal only)
// ----------------------
async function computeLiquorSnapshots(
	tx: Prisma.TransactionClient,
	start: Date,
	end: Date,
	dayClosingId: number
) {
	// 1. Find all active liquor items
	const liquorItems: Array<{ id: bigint; ml_per_unit: number | null }> =
		await tx.$queryRaw`
			SELECT DISTINCT i.id, i.ml_per_unit
			FROM "Item" i
			WHERE i.is_liquor = true
			  AND i.ml_per_unit IS NOT NULL
			  AND i.ml_per_unit > 0
			  AND (
			    EXISTS (
			      SELECT 1 FROM "PurchaseBatch" pb
			      WHERE pb.item_id = i.id AND pb.created_at BETWEEN ${start} AND ${end}
			    )
			    OR EXISTS (
			      SELECT 1 FROM "OpenLiquorBottle" ob
			      WHERE ob.item_id = i.id AND ob.opened_at <= ${end}
			    )
			    OR EXISTS (
			      SELECT 1 FROM "BillItem" bi
			      JOIN "Bill" b ON b.id = bi.bill_id
			      WHERE bi.item_id = i.id
			        AND b.bill_date BETWEEN ${start} AND ${end}
			        AND b.status != 'CANCELLED'
			    )
			  )
		`;

	if (!liquorItems || liquorItems.length === 0) return;

	const itemIds = liquorItems.map((r) => Number(r.id));

	// 2. Purchased today
	const purchased: Array<{ item_id: bigint; purchased_bottles: number }> =
		await tx.$queryRaw`
			SELECT pb.item_id, SUM(pb.qty_total)::float AS purchased_bottles
			FROM "PurchaseBatch" pb
			JOIN "Purchase" p ON p.id = pb.purchase_id
			WHERE pb.item_id = ANY(${itemIds}::int[])
			  AND p.purchase_date BETWEEN ${start} AND ${end}
			GROUP BY pb.item_id
		`;

	// 3. Broken today
	const broken: Array<{ item_id: bigint; broken_bottles: number }> =
		await tx.$queryRaw`
			SELECT sm.item_id, SUM(-sm.change_qty)::float AS broken_bottles
			FROM "StockMovement" sm
			WHERE sm.item_id = ANY(${itemIds}::int[])
			  AND sm.movement_type = 'BREAKAGE'
			  AND sm.created_at BETWEEN ${start} AND ${end}
			GROUP BY sm.item_id
		`;

	// 4. Sealed bottles sold today
	const sealedSold: Array<{ item_id: bigint; sealed_sold: number }> =
		await tx.$queryRaw`
			SELECT bi.item_id, SUM(bi.quantity)::float AS sealed_sold
			FROM "BillItem" bi
			JOIN "Bill" b ON b.id = bi.bill_id
			WHERE bi.item_id = ANY(${itemIds}::int[])
			  AND bi.sale_mode = 'BOTTLE'
			  AND b.bill_date BETWEEN ${start} AND ${end}
			  AND b.status != 'CANCELLED'
			GROUP BY bi.item_id
		`;

	// 5. Shot ml sold today
	const shotsMl: Array<{ item_id: bigint; shots_ml_sold: number }> =
		await tx.$queryRaw`
			SELECT ob.item_id, SUM(lsu.ml_used)::float AS shots_ml_sold
			FROM "LiquorShotUsage" lsu
			JOIN "OpenLiquorBottle" ob ON ob.id = lsu.open_bottle_id
			WHERE ob.item_id = ANY(${itemIds}::int[])
			  AND lsu.used_at BETWEEN ${start} AND ${end}
			GROUP BY ob.item_id
		`;

	// 6. Current open bottle ml at time of closing
	const openMlData: Array<{ item_id: bigint; open_bottles_ml: number }> =
		await tx.$queryRaw`
			SELECT item_id, SUM(ml_remaining)::float AS open_bottles_ml
			FROM "OpenLiquorBottle"
			WHERE item_id = ANY(${itemIds}::int[])
			  AND status = 'OPEN'
			  AND opened_at <= ${end}
			GROUP BY item_id
		`;

	// 7. Previous day snapshot for opening stock
	const prevDate = new Date(start);
	prevDate.setDate(prevDate.getDate() - 1);
	prevDate.setHours(0, 0, 0, 0);

	const prevSnapshots = await tx.dayLiquorSnapshot.findMany({
		where: { dayClosing: { business_date: prevDate } }
	});

	// Build lookup maps
	const toMap = <T extends { item_id: bigint | number }>(arr: T[]) =>
		new Map(arr.map((r) => [Number(r.item_id), r]));

	const purchasedMap = toMap(purchased);
	const brokenMap    = toMap(broken);
	const sealedMap    = toMap(sealedSold);
	const shotsMlMap   = toMap(shotsMl);
	const openMlMap    = toMap(openMlData);
	const prevMap      = new Map(prevSnapshots.map((p) => [p.item_id, p]));

	for (const row of liquorItems) {
		const itemId    = Number(row.id);
		const mlPerUnit = Number(row.ml_per_unit ?? 0);

		const purchasedBottles = Number(purchasedMap.get(itemId)?.purchased_bottles ?? 0);
		const brokenBottles    = Number(brokenMap.get(itemId)?.broken_bottles ?? 0);
		const sealedBottles    = Number(sealedMap.get(itemId)?.sealed_sold ?? 0);
		const shotsMlSold      = Number(shotsMlMap.get(itemId)?.shots_ml_sold ?? 0);
		const openMl           = Number(openMlMap.get(itemId)?.open_bottles_ml ?? 0);

		// Opening bottles from yesterday's snapshot, or derive from current stock
		let openingBottles = 0;
		const prev = prevMap.get(itemId);
		if (prev) {
			openingBottles = Number(prev.opening_bottles ?? 0);
		} else {
			const stockRow: Array<{ total_qty: number }> = await tx.$queryRaw`
				SELECT COALESCE(SUM(qty_remaining), 0)::float AS total_qty
				FROM "PurchaseBatch"
				WHERE item_id = ${itemId}
			`;
			const currentQty = Number(stockRow[0]?.total_qty ?? 0);
			// opening = current + what was sold + broken - what was purchased
			openingBottles = Math.max(0, currentQty + sealedBottles + brokenBottles - purchasedBottles);
		}

		// Theoretical ml = what should be in open bottles
		const theoreticalMl =
			(openingBottles + purchasedBottles - sealedBottles - brokenBottles) * mlPerUnit - shotsMlSold;

		// Variance = actual - theoretical (negative = missing ml)
		const varianceMl = openMl - theoreticalMl;

		await tx.dayLiquorSnapshot.create({
			data: {
				day_closing_id: dayClosingId,
				item_id: itemId,
				opening_bottles: openingBottles,
				purchased_bottles: purchasedBottles,
				broken_bottles: brokenBottles,
				sealed_sold: sealedBottles,
				shots_ml_sold: shotsMlSold,
				open_bottles_ml: openMl,
				theoretical_ml: theoreticalMl,
				variance_ml: varianceMl
			}
		});
	}
}