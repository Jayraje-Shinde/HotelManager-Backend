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




/**
 * Compute and store DayLiquorSnapshot rows for a business day.
 * Must be called inside a Prisma transaction: await computeLiquorSnapshots(tx, start, end, dc.id, { mlPerShot: 30 })
 */
export async function computeLiquorSnapshots(
	tx: Prisma.TransactionClient,
	start: Date,
	end: Date,
	dayClosingId: number,
	opts?: { mlPerShot?: number }
) {
	const mlPerShot = opts?.mlPerShot ?? 30;

	// 1) Identify liquor items with any activity or open bottles
	const liquorItemsRows: Array<{ id: number; ml_per_unit: number | null }> = await tx.$queryRawUnsafe(`
    SELECT DISTINCT i.id, i.ml_per_unit
    FROM "Item" i
    LEFT JOIN "PurchaseBatch" pb ON pb.item_id = i.id
    LEFT JOIN "OpenLiquorBottle" ob ON ob.item_id = i.id
    LEFT JOIN "LiquorShotUsage" lsu ON lsu.open_bottle_id = ob.id
    LEFT JOIN "BillItem" bi ON bi.item_id = i.id
    WHERE i.is_liquor = true
      AND (
           (pb.created_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}')
        OR (ob.opened_at <= '${end.toISOString()}')
        OR (lsu.used_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}')
        OR (bi.id IS NOT NULL AND EXISTS (
              SELECT 1 FROM "Bill" b WHERE b.id = bi.bill_id AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
           ))
      )
  `) as any[];

	if (!liquorItemsRows || liquorItemsRows.length === 0) return;

	const itemIds = liquorItemsRows.map((r) => Number(r.id)).filter(Boolean);
	if (itemIds.length === 0) return;

	const idsCsv = itemIds.join(",");

	// 2) purchased_bottles per item
	const purchased = (await tx.$queryRawUnsafe(`
    SELECT pb.item_id::int AS item_id, SUM(pb.qty_total)::float AS purchased_bottles
    FROM "PurchaseBatch" pb
    JOIN "Purchase" p ON p.id = pb.purchase_id
    WHERE pb.item_id IN (${idsCsv})
      AND p.purchase_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY pb.item_id
  `)) as Array<{ item_id: number; purchased_bottles: number }>;

	// 3) broken_bottles per item (from StockMovement BREAKAGE)
	const broken = (await tx.$queryRawUnsafe(`
    SELECT sm.item_id::int AS item_id, SUM((-1) * sm.change_qty)::float AS broken_bottles
    FROM "StockMovement" sm
    WHERE sm.item_id IN (${idsCsv})
      AND sm.movement_type = 'BREAKAGE'
      AND sm.created_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY sm.item_id
  `)) as Array<{ item_id: number; broken_bottles: number }>;

	// 4) sealed_sold from BillItem
	const sealedSold = (await tx.$queryRawUnsafe(`
    SELECT bi.item_id::int AS item_id, SUM(bi.quantity)::float AS sealed_sold
    FROM "BillItem" bi
    JOIN "Bill" b ON b.id = bi.bill_id
    WHERE bi.item_id IN (${idsCsv})
      AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
      AND b.status != 'CANCELLED'
    GROUP BY bi.item_id
  `)) as Array<{ item_id: number; sealed_sold: number }>;

	// 5) shots_ml_sold from LiquorShotUsage (joined to open bottle to get item_id)
	const shots = (await tx.$queryRawUnsafe(`
    SELECT ob.item_id::int AS item_id, SUM(lsu.ml_used)::float AS shots_ml_sold
    FROM "LiquorShotUsage" lsu
    JOIN "OpenLiquorBottle" ob ON ob.id = lsu.open_bottle_id
    WHERE ob.item_id IN (${idsCsv})
      AND lsu.used_at BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY ob.item_id
  `)) as Array<{ item_id: number; shots_ml_sold: number }>;

	// 6) open_bottles_ml at close time
	const openBottles = (await tx.$queryRawUnsafe(`
    SELECT item_id::int AS item_id, SUM(ml_remaining)::float AS open_bottles_ml, COUNT(*)::int AS open_bottles_count
    FROM "OpenLiquorBottle"
    WHERE item_id IN (${idsCsv})
      AND opened_at <= '${end.toISOString()}'
    GROUP BY item_id
  `)) as Array<{ item_id: number; open_bottles_ml: number; open_bottles_count: number }>;

	// 7) sealed_sold_from_batches (if you track via BillItemBatch)
	const sealedFromBatches = (await tx.$queryRawUnsafe(`
    SELECT pb.item_id::int AS item_id, SUM(bib.qty_used)::float AS sealed_sold_from_batches
    FROM "BillItemBatch" bib
    JOIN "PurchaseBatch" pb ON pb.id = bib.purchase_batch_id
    JOIN "BillItem" bi ON bi.id = bib.bill_item_id
    JOIN "Bill" b ON b.id = bi.bill_id
    WHERE pb.item_id IN (${idsCsv})
      AND b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
    GROUP BY pb.item_id
  `)) as Array<{ item_id: number; sealed_sold_from_batches: number }>;

	// 8) previous day snapshot lookup via relation to DayClosing
	const prevStart = new Date(start);
	prevStart.setDate(prevStart.getDate() - 1);
	prevStart.setHours(0, 0, 0, 0);

	const prevSnapshots = await tx.dayLiquorSnapshot.findMany({
		where: { dayClosing: { business_date: prevStart } as any }
	});

	// Build maps
	const map = <T extends { item_id?: number }>(arr: T[] | undefined) => {
		const m = new Map<number, T>();
		(arr || []).forEach((r: any) => {
			const id = Number(r.item_id ?? r.itemId ?? r.id);
			if (!Number.isNaN(id)) m.set(id, r);
		});
		return m;
	};

	const purchasedMap = map(purchased);
	const brokenMap = map(broken);
	const sealedMap = map(sealedSold);
	const sealedBatchMap = map(sealedFromBatches);
	const shotsMap = map(shots);
	const openBottlesMap = map(openBottles);
	const prevMap = new Map<number, any>();
	for (const p of prevSnapshots || []) {
		prevMap.set(Number((p as any).item_id), p);
	}

	// Insert snapshots (one by one; safe and simple)
	for (const itemRow of liquorItemsRows) {
		const itemId = Number(itemRow.id);
		const mlPerUnit = Number(itemRow.ml_per_unit ?? 0);

		if (!mlPerUnit || mlPerUnit <= 0) {
			console.warn(`computeLiquorSnapshots: item ${itemId} missing or invalid ml_per_unit — skipping snapshot`);
			continue;
		}

		const purchasedBottles = Number(purchasedMap.get(itemId)?.purchased_bottles ?? 0);
		const brokenBottles = Number(brokenMap.get(itemId)?.broken_bottles ?? 0);
		const sealedSold = Number(sealedMap.get(itemId)?.sealed_sold ?? 0) + Number(sealedBatchMap.get(itemId)?.sealed_sold_from_batches ?? 0);
		const shotsMlSold = Number(shotsMap.get(itemId)?.shots_ml_sold ?? 0);
		const openBottlesMl = Number(openBottlesMap.get(itemId)?.open_bottles_ml ?? 0);
		const openBottlesCount = Number(openBottlesMap.get(itemId)?.open_bottles_count ?? 0);

		// Determine opening_bottles: prefer previous snapshot, fallback to derive from current stock
		let openingBottles = 0;
		const prev = prevMap.get(itemId);
		if (prev && typeof prev.opening_bottles !== "undefined") {
			openingBottles = Number(prev.opening_bottles ?? 0);
		} else {
			// fallback: compute current qty from purchase batches
			const stockRow = (await tx.$queryRawUnsafe(`
        SELECT COALESCE(SUM(qty_remaining),0)::float AS total_qty
        FROM "PurchaseBatch"
        WHERE item_id = ${itemId}
      `)) as any[];

			const currentQty = Number((stockRow && stockRow[0] && stockRow[0].total_qty) ?? 0);
			openingBottles = currentQty + sealedSold - purchasedBottles + brokenBottles;
			if (openingBottles < 0) openingBottles = 0;
		}

		const theoreticalMl = (openingBottles + purchasedBottles - sealedSold - brokenBottles) * mlPerUnit - shotsMlSold;
		const varianceMl = openBottlesMl - theoreticalMl;

		// Insert DayLiquorSnapshot
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



export async function getPrecheck(business_date: string) {
	if (!business_date) throw new Error("business_date required");

	const start = normalizeDate(business_date);
	const end = new Date(start);
	end.setHours(23, 59, 59, 999);

	// 1. Open Bills
	const openBills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: start, lte: end },
			status: { in: ["OPEN", "PAID"] } // PAID but not closed still counts
		},
		select: { id: true, table_no: true, total: true, status: true }
	});

	// 2. Open KOTs
	const openKots = await prisma.kOT.findMany({
		where: {
			created_at: { gte: start, lte: end },
			status: { notIn: ["CLOSED", "CANCELLED"] }
		},
		select: { id: true, table_no: true, status: true }
	});

	// 3. Open Liquor Bottles (ml > 0)
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

	// 5. Missing ml_per_unit (liquor items)
	const liquorErrors = await prisma.item.findMany({
		where: {
			is_liquor: true,
			OR: [{ ml_per_unit: null }, { ml_per_unit: { equals: 0 } }]
		},
		select: { id: true, name: true, ml_per_unit: true }
	});

	// 6. Suspicious ml_remaining on bottles (ml > bottle size)
	const bottleOverflow = await prisma.openLiquorBottle.findMany({
		where: {
			ml_remaining: { gt: prisma.openLiquorBottle.fields.item_id } // not directly allowed, so raw query below
		}
	}).catch(() => []);

	// FIX bottleOverflow using raw SQL
	const overflowRaw = await prisma.$queryRawUnsafe(`
		SELECT ob.id, ob.item_id, ob.ml_remaining, i.ml_per_unit, i.name
		FROM "OpenLiquorBottle" ob
		JOIN "Item" i ON i.id = ob.item_id
		WHERE ob.ml_remaining > COALESCE(i.ml_per_unit, 0)
	`);

	// 7. Payment mismatch (sum of payments != final bill totals)
	const paymentMismatch = await prisma.$queryRawUnsafe(`
		SELECT b.id, b.total, COALESCE(SUM(p.amount),0) AS paid
		FROM "Bill" b
		LEFT JOIN "Payment" p ON p.billId = b.id
		WHERE b.bill_date BETWEEN '${start.toISOString()}' AND '${end.toISOString()}'
		GROUP BY b.id
		HAVING COALESCE(SUM(p.amount),0) != b.total - COALESCE(b.discount,0)
	`);

	// 8. Pending purchase rollbacks (if any)
	const rollbackCandidates = await prisma.purchase.findMany({
		where: {
			purchase_date: { gte: start, lte: end },
			// You should add a 'rollback_done' flag on purchase table, but for now:
		},
		select: { id: true, invoice_no: true, total_amount: true }
	});

	return {
		date: business_date,
		open_bills_count: openBills.length,
		open_kots_count: openKots.length,
		open_bottles_count: openBottles.length,
		negative_stock_count: negativeStock.length,
		liquor_items_missing_ml: liquorErrors,
		bottles_with_overflow_ml: overflowRaw,
		payment_mismatch: paymentMismatch,
		pending_purchase_checks: rollbackCandidates,

		open_bills: openBills,
		open_kots: openKots,
		open_bottles: openBottles,
		negative_stock: negativeStock
	};
}
