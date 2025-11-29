import prisma from "../../config/db";
import crypto from "crypto";
import { Prisma } from "@prisma/client";


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

			await computeLiquorSnapshots(tx, start, end, dc.id, { mlPerShot: 30 });

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

//liquor snapshot 

// call from within a transaction: await computeLiquorSnapshots(tx, businessDateStart, businessDateEnd, dayClosingId, { mlPerShot: 30 });


export async function computeLiquorSnapshots(
	tx: Prisma.TransactionClient,
	start: Date,
	end: Date,
	dayClosingId: number,
	opts?: { mlPerShot?: number }
) {
	const mlPerShot = opts?.mlPerShot ?? 30;

	// 1) Get all liquor items that had any activity today OR any open bottles OR exist in purchase batches
	const liquorItemsRows: any[] = await tx.$queryRawUnsafe(`
    SELECT DISTINCT i.id, i.ml_per_unit
    FROM "Item" i
    LEFT JOIN "PurchaseBatch" pb ON pb.item_id = i.id
    LEFT JOIN "OpenLiquorBottle" ob ON ob.item_id = i.id
    LEFT JOIN "LiquorShotUsage" lsu ON lsu.open_bottle_id = ob.id
    LEFT JOIN "BillItem" bi ON bi.item_id = i.id
    LEFT JOIN "KOT" k ON k.id = lsu.kot_id
    WHERE i.is_liquor = true
      AND (
           (pb.created_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}')
        OR (ob.opened_at <= '${end.toISOString()}')
        OR (lsu.used_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}')
        OR (bi.id IS NOT NULL AND EXISTS (
              SELECT 1 FROM "Bill" b WHERE b.id = bi.bill_id AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
           ))
      )
  `);

	// if none found, exit
	if (!liquorItemsRows || liquorItemsRows.length === 0) {
		return;
	}

	// Helper queries: we'll run grouped queries per metric to minimize roundtrips
	const itemIds = liquorItemsRows.map((r) => Number(r.id));

	// 2) purchased_bottles per item (bottles purchased today) — use PurchaseBatch or PurchaseItem
	const purchased = await tx.$queryRawUnsafe(`
    SELECT pb.item_id, SUM(pb.qty_total) AS purchased_bottles
    FROM "PurchaseBatch" pb
    JOIN "Purchase" p ON p.id = pb.purchase_id
    WHERE pb.item_id IN (${itemIds.join(",")})
      AND p.purchase_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY pb.item_id
  `) as any[];

	// 3) broken_bottles per item (from StockMovement of BREAKAGE) - count or qty
	const broken = await tx.$queryRawUnsafe(`
    SELECT sm.item_id, SUM(sm.change_qty * -1) AS broken_bottles
    FROM "StockMovement" sm
    WHERE sm.item_id IN (${itemIds.join(",")})
      AND sm.movement_type = 'BREAKAGE'
      AND sm.created_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY sm.item_id
  `) as any[];

	// 4) sealed_sold (bottles sold sealed) — sum BillItem.quantity for bills in date range where item is liquor
	const sealedSold = await tx.$queryRawUnsafe(`
    SELECT bi.item_id, SUM(bi.quantity) AS sealed_sold
    FROM "BillItem" bi
    JOIN "Bill" b ON b.id = bi.bill_id
    WHERE bi.item_id IN (${itemIds.join(",")})
      AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
      AND b.status != 'CANCELLED'
    GROUP BY bi.item_id
  `) as any[];

	// 5) shots_ml_sold — sum LiquorShotUsage.ml_used for day
	const shots = await tx.$queryRawUnsafe(`
    SELECT ob.item_id, SUM(lsu.ml_used) AS shots_ml_sold
    FROM "LiquorShotUsage" lsu
    JOIN "OpenLiquorBottle" ob ON ob.id = lsu.open_bottle_id
    WHERE ob.item_id IN (${itemIds.join(",")})
      AND lsu.used_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY ob.item_id
  `) as any[];

	// 6) open_bottles_ml at close time — sum ml_remaining for open bottles (opened <= end)
	const openBottles = await tx.$queryRawUnsafe(`
    SELECT item_id, SUM(ml_remaining) AS open_bottles_ml, COUNT(*) AS open_bottles_count
    FROM "OpenLiquorBottle"
    WHERE item_id IN (${itemIds.join(",")})
      AND opened_at <= '${end.toISOString()}'
    GROUP BY item_id
  `) as any[];

	// 7) sealed_sold may also have bottle consumption recorded against BillItemBatch; ensure to add if using batches
	// If your BillItemBatch.qty_used is used to consume sealed bottles, incorporate it. Example:
	const sealedFromBatches = await tx.$queryRawUnsafe(`
    SELECT pb.item_id, SUM(bib.qty_used) AS sealed_sold_from_batches
    FROM "BillItemBatch" bib
    JOIN "PurchaseBatch" pb ON pb.id = bib.purchase_batch_id
    JOIN "BillItem" bi ON bi.id = bib.bill_item_id
    JOIN "Bill" b ON b.id = bi.bill_id
    WHERE pb.item_id IN (${itemIds.join(",")})
      AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY pb.item_id
  `) as any[];

	// 8) Fetch previous day liquor snapshot for opening bottles fallback
	const prevStart = new Date(start);
	prevStart.setDate(prevStart.getDate() - 1);
	prevStart.setHours(0, 0, 0, 0);

	const prevSnapshots = await tx.dayLiquorSnapshot.findMany({
		where: { dayClosing: { business_date: prevStart } as any }, // may need join; fallback below
	}).catch(() => []);

	// convenience lookup maps
	const mapBy = (arr: any[], key = "item_id") => {
		const m = new Map<number, any>();
		for (const r of arr || []) m.set(Number(r.item_id ?? r.id ?? r.itemId), r);
		return m;
	};

	const purchasedMap = mapBy(purchased);
	const brokenMap = mapBy(broken);
	const sealedMap = mapBy(sealedSold);
	const shotsMap = mapBy(shots);
	const openBottlesMap = mapBy(openBottles);
	const sealedBatchMap = mapBy(sealedFromBatches);
	const prevMap = new Map<number, any>();
	for (const p of prevSnapshots || []) {
		// if prevSnapshots rows have item_id field
		prevMap.set(Number((p as any).item_id), p);
	}

	// 9) For each item compute and insert DayLiquorSnapshot
	for (const itemRow of liquorItemsRows) {
		const itemId = Number(itemRow.id);
		const mlPerUnit = Number(itemRow.ml_per_unit ?? 0);

		const purchasedBottles = Number(purchasedMap.get(itemId)?.purchased_bottles ?? 0);
		const brokenBottles = Number(brokenMap.get(itemId)?.broken_bottles ?? 0);
		const sealedSold = Number(sealedMap.get(itemId)?.sealed_sold ?? 0) + Number(sealedBatchMap.get(itemId)?.sealed_sold_from_batches ?? 0);
		const shotsMlSold = Number(shotsMap.get(itemId)?.shots_ml_sold ?? 0);
		const openBottlesMl = Number(openBottlesMap.get(itemId)?.open_bottles_ml ?? 0);
		const openBottlesCount = Number(openBottlesMap.get(itemId)?.open_bottles_count ?? 0);

		// Determine opening_bottles:
		let openingBottles = 0;
		const prev = prevMap.get(itemId);
		if (prev && typeof prev.opening_bottles !== "undefined") {
			// If prev snapshot exists, opening for today = prev's (closing) expected bottles:
			// We stored only opening_bottles in prev snapshot; if you stored closing info differently, adapt.
			openingBottles = Number(prev.opening_bottles ?? 0);
		} else {
			// fallback: derive opening from stock + sealed_sold - purchased + broken
			// Attempt to compute current stock qty_remaining (bottle counts)
			const stockRow = await tx.$queryRawUnsafe(`
        SELECT SUM(qty_remaining) AS total_qty
        FROM "PurchaseBatch"
        WHERE item_id = ${itemId}
      `) as any[];

			const currentQty = Number((stockRow && stockRow[0] && stockRow[0].total_qty) ?? 0);

			// opening = current + sealed_sold - purchased + broken
			openingBottles = currentQty + sealedSold - purchasedBottles + brokenBottles;
			if (openingBottles < 0) openingBottles = 0;
		}

		// Theoretical ml remaining after day's activities
		const theoreticalMl = (openingBottles + purchasedBottles - sealedSold - brokenBottles) * mlPerUnit - shotsMlSold;

		// Variance
		const varianceMl = openBottlesMl - theoreticalMl;

		// Insert snapshot
		await tx.dayLiquorSnapshot.create({
			data: {
				day_closing_id: dayClosingId,
				item_id: itemId,
				opening_bottles: openingBottles,
				purchased_bottles: purchasedBottles,
				broken_bottles: brokenBottles,
				sealed_sold: sealedSold,
				shots_ml_sold: shotsMlSold,
				open_bottles_ml: openBottlesMl,
				theoretical_ml: theoreticalMl,
				variance_ml: varianceMl
			}
		});
	}

	// done
	return;
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
