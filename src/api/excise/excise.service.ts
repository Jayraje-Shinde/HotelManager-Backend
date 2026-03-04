import prisma from "../../config/db";

function dayRange(dateStr: string) {
	const start = new Date(dateStr + "T00:00:00");
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

function monthRange(yearMonth: string) {
	// yearMonth = "2026-03"
	const [y, m] = yearMonth.split("-").map(Number);
	const start  = new Date(y, m - 1, 1, 0, 0, 0);
	const end    = new Date(y, m, 0, 23, 59, 59, 999);
	return { start, end };
}

// ============================================================
// FLR-1/A — BRAND-WISE DAILY STOCK REGISTER
// Required by Maharashtra Excise for FL3 permit rooms.
// Must be filled daily before close of premises.
// Shows: opening stock, purchased, sealed sold, shots ml sold,
//        breakage, and computed closing stock per brand.
// ============================================================
export async function flr1a(dateStr: string) {
	const { start, end } = dayRange(dateStr);

	// Previous day closing stock = opening for today
	const prevDate = new Date(start);
	prevDate.setDate(prevDate.getDate() - 1);
	prevDate.setHours(0, 0, 0, 0);

	const prevSnapshot = await prisma.dayLiquorSnapshot.findMany({
		where:   { dayClosing: { business_date: prevDate } },
		include: { item: { select: { id: true, name: true, ml_per_unit: true } } }
	});

	const prevMap = new Map(prevSnapshot.map((s) => [s.item_id, s]));

	// All active liquor items
	const items = await prisma.item.findMany({
		where:   { is_liquor: true, ml_per_unit: { gt: 0 } },
		orderBy: { name: "asc" }
	});

	const rows = await Promise.all(items.map(async (item) => {
		// Purchases today
		const purchased: Array<{ qty: number }> = await prisma.$queryRaw`
			SELECT COALESCE(SUM(pb.qty_total), 0)::float AS qty
			FROM "PurchaseBatch" pb
			JOIN "Purchase" p ON p.id = pb.purchase_id
			WHERE pb.item_id = ${item.id}
			  AND p.purchase_date BETWEEN ${start} AND ${end}
		`;
		const purchasedBottles = Number(purchased[0]?.qty ?? 0);

		// Sealed bottles sold today (BOTTLE mode)
		const sealed: Array<{ qty: number }> = await prisma.$queryRaw`
			SELECT COALESCE(SUM(bi.quantity), 0)::float AS qty
			FROM "BillItem" bi
			JOIN "Bill" b ON b.id = bi.bill_id
			WHERE bi.item_id = ${item.id}
			  AND bi.sale_mode = 'BOTTLE'
			  AND b.bill_date BETWEEN ${start} AND ${end}
			  AND b.status != 'CANCELLED'
		`;
		const sealedSold = Number(sealed[0]?.qty ?? 0);

		// Shot ml sold today
		const shots: Array<{ ml: number }> = await prisma.$queryRaw`
			SELECT COALESCE(SUM(lsu.ml_used), 0)::float AS ml
			FROM "LiquorShotUsage" lsu
			JOIN "OpenLiquorBottle" ob ON ob.id = lsu.open_bottle_id
			WHERE ob.item_id = ${item.id}
			  AND lsu.used_at BETWEEN ${start} AND ${end}
		`;
		const shotsMl = Number(shots[0]?.ml ?? 0);
		const shotsInBottleEquiv = item.ml_per_unit ? shotsMl / item.ml_per_unit : 0;

		// Breakage today
		const brk: Array<{ qty: number }> = await prisma.$queryRaw`
			SELECT COALESCE(SUM(-sm.change_qty), 0)::float AS qty
			FROM "StockMovement" sm
			WHERE sm.item_id = ${item.id}
			  AND sm.movement_type = 'BREAKAGE'
			  AND sm.created_at BETWEEN ${start} AND ${end}
		`;
		const breakage = Number(brk[0]?.qty ?? 0);

		// Opening stock: from previous day snapshot, else current batch stock
		let openingBottles = 0;
		const prev = prevMap.get(item.id);
		if (prev) {
			// closing stock of yesterday = opening today
			openingBottles = Number(prev.opening_bottles) + Number(prev.purchased_bottles)
				- Number(prev.sealed_sold) - Number(prev.broken_bottles)
				- (item.ml_per_unit ? Number(prev.shots_ml_sold) / item.ml_per_unit : 0);
			openingBottles = Math.max(0, openingBottles);
		} else {
			// Fallback: current batch stock + what was consumed today
			const stockRow: Array<{ qty: number }> = await prisma.$queryRaw`
				SELECT COALESCE(SUM(qty_remaining), 0)::float AS qty
				FROM "PurchaseBatch" WHERE item_id = ${item.id}
			`;
			const current = Number(stockRow[0]?.qty ?? 0);
			openingBottles = current + sealedSold + breakage - purchasedBottles;
			openingBottles = Math.max(0, openingBottles);
		}

		// Current open bottles ml
		const openMl: Array<{ ml: number }> = await prisma.$queryRaw`
			SELECT COALESCE(SUM(ml_remaining), 0)::float AS ml
			FROM "OpenLiquorBottle"
			WHERE item_id = ${item.id} AND status = 'OPEN'
		`;
		const openBottlesMl = Number(openMl[0]?.ml ?? 0);

		// Sealed closing stock
		const closingBottles = Math.max(0,
			openingBottles + purchasedBottles - sealedSold - breakage - shotsInBottleEquiv
		);

		return {
			item_id:           item.id,
			brand_name:        item.name,
			ml_per_unit:       item.ml_per_unit,
			opening_bottles:   +openingBottles.toFixed(3),
			purchased_bottles: purchasedBottles,
			sealed_sold:       sealedSold,
			shots_ml_sold:     shotsMl,
			breakage_bottles:  breakage,
			closing_bottles:   +closingBottles.toFixed(3),
			open_bottles_ml:   openBottlesMl,    // ml still in open/broken bottles
		};
	}));

	return {
		register:      "FLR-1/A",
		date:          dateStr,
		report_name:   "Brand-Wise Daily Stock Register",
		generated_at:  new Date().toISOString(),
		brands:        rows.filter(r => r.opening_bottles > 0 || r.purchased_bottles > 0 || r.sealed_sold > 0 || r.shots_ml_sold > 0)
	};
}

// ============================================================
// FLR-3/A — DAILY TRANSACTION REGISTER (Monthly View)
// All daily transactions for the month, grouped by day.
// One row per brand per day that had any activity.
// ============================================================
export async function flr3a(yearMonth: string) {
	const { start, end } = monthRange(yearMonth);

	// Get all closed day snapshots for this month
	const dayClosings = await prisma.dayClosing.findMany({
		where:   { business_date: { gte: start, lte: end }, status: "CLOSED" },
		include: {
			liquorSnapshots: {
				include: { item: { select: { id: true, name: true, ml_per_unit: true } } }
			}
		},
		orderBy: { business_date: "asc" }
	});

	const rows: any[] = [];
	for (const dc of dayClosings) {
		for (const s of dc.liquorSnapshots) {
			if (s.sealed_sold === 0 && s.shots_ml_sold === 0 && s.purchased_bottles === 0) continue;
			rows.push({
				date:              dc.business_date,
				brand_name:        s.item.name,
				ml_per_unit:       s.item.ml_per_unit,
				opening_bottles:   s.opening_bottles,
				purchased:         s.purchased_bottles,
				sealed_sold:       s.sealed_sold,
				shots_ml_sold:     s.shots_ml_sold,
				broken_bottles:    s.broken_bottles,
				open_bottles_ml:   s.open_bottles_ml,
				theoretical_ml:    s.theoretical_ml,
				variance_ml:       s.variance_ml,
			});
		}
	}

	// Running totals for the month
	const totals = rows.reduce((acc, r) => {
		acc.purchased   += r.purchased;
		acc.sealed_sold += r.sealed_sold;
		acc.shots_ml    += r.shots_ml_sold;
		acc.breakage    += r.broken_bottles;
		return acc;
	}, { purchased: 0, sealed_sold: 0, shots_ml: 0, breakage: 0 });

	return {
		register:     "FLR-3/A",
		month:        yearMonth,
		report_name:  "Daily Transaction Register",
		generated_at: new Date().toISOString(),
		monthly_totals: totals,
		entries:      rows
	};
}

// ============================================================
// FLR-4 — MONTHLY EXCISE STATEMENT
// Summary submitted to Excise Officer every month.
// Per-brand totals for the month: purchases, sales, closing stock.
// ============================================================
export async function flr4(yearMonth: string) {
	const { start, end } = monthRange(yearMonth);

	const [y, m] = yearMonth.split("-").map(Number);
	const prevMonth = m === 1
		? `${y - 1}-12`
		: `${y}-${String(m - 1).padStart(2, "0")}`;

	// Last day of previous month for opening stock
	const prevEnd = new Date(y, m - 1, 0, 23, 59, 59, 999);
	const prevSnapshots = await prisma.dayClosing.findMany({
		where:   { business_date: { lte: prevEnd }, status: "CLOSED" },
		include: { liquorSnapshots: { include: { item: true } } },
		orderBy: { business_date: "desc" },
		take:    1
	});

	const openingMap = new Map<number, number>();
	if (prevSnapshots.length > 0) {
		for (const s of prevSnapshots[0].liquorSnapshots) {
			const closing = s.opening_bottles + s.purchased_bottles - s.sealed_sold
				- s.broken_bottles - (s.item.ml_per_unit ? s.shots_ml_sold / s.item.ml_per_unit : 0);
			openingMap.set(s.item_id, Math.max(0, closing));
		}
	}

	// All this month's day closings
	const dayClosings = await prisma.dayClosing.findMany({
		where:   { business_date: { gte: start, lte: end }, status: "CLOSED" },
		include: { liquorSnapshots: { include: { item: true } } },
		orderBy: { business_date: "asc" }
	});

	// Aggregate by item
	const itemMap = new Map<number, any>();
	for (const dc of dayClosings) {
		for (const s of dc.liquorSnapshots) {
			const id = s.item_id;
			if (!itemMap.has(id)) {
				itemMap.set(id, {
					item_id:            id,
					brand_name:         s.item.name,
					ml_per_unit:        s.item.ml_per_unit,
					excise_rate:        s.item.excise_rate ?? 0,
					opening_bottles:    openingMap.get(id) ?? 0,
					purchased_bottles:  0,
					sealed_sold:        0,
					shots_ml_sold:      0,
					broken_bottles:     0,
					total_variance_ml:  0,
				});
			}
			const rec = itemMap.get(id);
			rec.purchased_bottles += s.purchased_bottles;
			rec.sealed_sold       += s.sealed_sold;
			rec.shots_ml_sold     += s.shots_ml_sold;
			rec.broken_bottles    += s.broken_bottles;
			rec.total_variance_ml += s.variance_ml;
		}
	}

	// Closing stock & MRP value
	const brands = [...itemMap.values()].map((r) => {
		const mlPerUnit = r.ml_per_unit ?? 0;
		const shotsBottleEquiv = mlPerUnit ? r.shots_ml_sold / mlPerUnit : 0;
		const closing = Math.max(0,
			r.opening_bottles + r.purchased_bottles - r.sealed_sold - r.broken_bottles - shotsBottleEquiv
		);
		return {
			...r,
			closing_bottles:  +closing.toFixed(3),
			mrp_stock_value:  +(closing * (r.excise_rate ?? 0)).toFixed(2)
		};
	}).sort((a, b) => a.brand_name.localeCompare(b.brand_name));

	const grandTotals = brands.reduce((acc, r) => {
		acc.opening   += r.opening_bottles;
		acc.purchased += r.purchased_bottles;
		acc.sold      += r.sealed_sold;
		acc.shots_ml  += r.shots_ml_sold;
		acc.broken    += r.broken_bottles;
		acc.closing   += r.closing_bottles;
		acc.mrp_value += r.mrp_stock_value;
		return acc;
	}, { opening: 0, purchased: 0, sold: 0, shots_ml: 0, broken: 0, closing: 0, mrp_value: 0 });

	return {
		register:     "FLR-4",
		month:        yearMonth,
		report_name:  "Monthly Excise Statement",
		generated_at: new Date().toISOString(),
		grand_totals:  grandTotals,
		brands
	};
}

// ============================================================
// DAILY CONSUMPTION REPORT
// Opening + Purchased - Closing = Total Consumed
// Compared against actual sales (sealed + shots)
// Highlights variance per brand per day
// ============================================================
export async function consumptionReport(dateStr: string) {
	const data = await flr1a(dateStr);

	const rows = data.brands.map((b: any) => {
		const mlConsumedSealed = b.sealed_sold * (b.ml_per_unit ?? 0);
		const totalMlConsumed  = mlConsumedSealed + b.shots_ml_sold;
		const totalMlSold      = mlConsumedSealed + b.shots_ml_sold;
		const variance         = totalMlConsumed - totalMlSold; // should be 0 ideally
		return {
			brand_name:         b.brand_name,
			ml_per_unit:        b.ml_per_unit,
			opening_bottles:    b.opening_bottles,
			purchased_bottles:  b.purchased_bottles,
			closing_bottles:    b.closing_bottles,
			consumed_bottles:   +(b.opening_bottles + b.purchased_bottles - b.closing_bottles).toFixed(3),
			sealed_sold:        b.sealed_sold,
			shots_ml_sold:      b.shots_ml_sold,
			total_ml_sold:      totalMlSold,
			open_bottles_ml:    b.open_bottles_ml,
			breakage:           b.breakage_bottles,
		};
	});

	return {
		report_name:  "Daily Consumption Report",
		date:         dateStr,
		generated_at: new Date().toISOString(),
		brands:       rows
	};
}

// ============================================================
// BREAKAGE REGISTER
// All bottle breakages — required for excise audit trail
// ============================================================
export async function breakageRegister(from?: string, to?: string) {
	const start = from ? new Date(from) : new Date("2000-01-01");
	const end   = to   ? new Date(to)   : new Date();
	end.setHours(23, 59, 59, 999);

	const movements = await prisma.stockMovement.findMany({
		where: {
			movement_type: "BREAKAGE",
			created_at:    { gte: start, lte: end }
		},
		include: {
			item: { select: { id: true, name: true, ml_per_unit: true, excise_rate: true } },
			user: { select: { id: true, name: true } }
		},
		orderBy: { created_at: "desc" }
	});

	// Also get open bottle breakages
	const openBottleBreakages = await prisma.openLiquorBottle.findMany({
		where: {
			status:   "BREAKAGE",
			closed_at: { gte: start, lte: end }
		},
		include: {
			item: { select: { id: true, name: true, ml_per_unit: true, excise_rate: true } }
		},
		orderBy: { closed_at: "desc" }
	});

	const stockBreakages = movements.map((m) => ({
		type:        "SEALED_BOTTLE",
		date:        m.created_at,
		brand_name:  m.item.name,
		item_id:     m.item_id,
		ml_per_unit: m.item.ml_per_unit,
		quantity:    Math.abs(m.change_qty),
		ml_lost:     Math.abs(m.change_qty) * (m.item.ml_per_unit ?? 0),
		reason:      m.reason,
		reported_by: m.user?.name ?? "Unknown",
		excise_rate: m.item.excise_rate ?? 0,
		mrp_loss:    Math.abs(m.change_qty) * (m.item.excise_rate ?? 0)
	}));

	const openBreakages = openBottleBreakages.map((b) => ({
		type:        "OPEN_BOTTLE",
		date:        b.closed_at ?? b.opened_at,
		brand_name:  b.item.name,
		item_id:     b.item_id,
		ml_per_unit: b.item.ml_per_unit,
		quantity:    1,
		ml_lost:     b.ml_remaining, // ml that was wasted when bottle broke
		reason:      b.breakage_reason ?? "Not specified",
		reported_by: "N/A",
		excise_rate: b.item.excise_rate ?? 0,
		mrp_loss:    0
	}));

	const all = [...stockBreakages, ...openBreakages]
		.sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

	const totalMlLost  = all.reduce((s, r) => s + r.ml_lost, 0);
	const totalMrpLoss = all.reduce((s, r) => s + r.mrp_loss, 0);

	return {
		report_name:    "Breakage Register",
		from:           from ?? "all",
		to:             to   ?? "all",
		generated_at:   new Date().toISOString(),
		summary: {
			total_incidents: all.length,
			total_ml_lost:   totalMlLost,
			total_mrp_loss:  totalMrpLoss
		},
		entries: all
	};
}

// ============================================================
// GST SEPARATED SALES REPORT
// Liquor is NOT under GST (state VAT/excise).
// Food items are GST applicable.
// This report splits daily/monthly sales by type.
// ============================================================
export async function gstSeparatedReport(from: string, to: string) {
	const start = new Date(from);
	const end   = new Date(to);
	end.setHours(23, 59, 59, 999);

	const bills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: start, lte: end },
			status:    { in: ["PAID", "CREDIT"] }
		},
		include: {
			items: { include: { item: { select: { id: true, name: true, is_liquor: true, tax_rate: true } } } },
			payments: true
		},
		orderBy: { bill_date: "asc" }
	});

	let foodSalesTotal   = 0;
	let liquorSalesTotal = 0;
	let foodTaxTotal     = 0;
	const gstBreakdown: Record<string, { taxable: number; tax: number }> = {};

	for (const bill of bills) {
		for (const bi of bill.items) {
			const amount = bi.subtotal ?? (bi.quantity * bi.rate);
			if (bi.item.is_liquor) {
				liquorSalesTotal += amount;
			} else {
				foodSalesTotal += amount;
				// GST grouping by rate
				const rate = bi.item.tax_rate ?? 0;
				const rateKey = `${rate}%`;
				if (!gstBreakdown[rateKey]) gstBreakdown[rateKey] = { taxable: 0, tax: 0 };
				// Back-calculate taxable value (amount is inclusive of tax)
				const taxable = rate > 0 ? amount / (1 + rate / 100) : amount;
				const tax     = amount - taxable;
				gstBreakdown[rateKey].taxable += taxable;
				gstBreakdown[rateKey].tax     += tax;
				foodTaxTotal += tax;
			}
		}
	}

	const paymentMethodTotals: Record<string, number> = {};
	for (const bill of bills) {
		for (const p of bill.payments) {
			paymentMethodTotals[p.method] = (paymentMethodTotals[p.method] ?? 0) + p.amount;
		}
	}

	return {
		report_name:   "GST Separated Sales Report",
		from,
		to,
		generated_at:  new Date().toISOString(),
		note:          "Liquor/alcohol is NOT subject to GST. State excise & VAT applies to liquor.",
		summary: {
			total_bills:         bills.length,
			food_sales_total:    +foodSalesTotal.toFixed(2),
			food_tax_total:      +foodTaxTotal.toFixed(2),
			food_taxable_value:  +(foodSalesTotal - foodTaxTotal).toFixed(2),
			liquor_sales_total:  +liquorSalesTotal.toFixed(2),
			grand_total:         +(foodSalesTotal + liquorSalesTotal).toFixed(2),
		},
		gst_breakdown:  Object.entries(gstBreakdown).map(([rate, v]) => ({
			gst_rate:      rate,
			taxable_value: +v.taxable.toFixed(2),
			tax_amount:    +v.tax.toFixed(2)
		})),
		payment_methods: paymentMethodTotals
	};
}

// ============================================================
// STOCK VARIANCE REPORT
// Theoretical vs actual ml per brand over a date range.
// Flag items with variance > threshold (default 50ml).
// ============================================================
export async function stockVarianceReport(from: string, to: string, thresholdMl: number = 50) {
	const start = new Date(from);
	const end   = new Date(to);
	end.setHours(23, 59, 59, 999);

	const snapshots = await prisma.dayLiquorSnapshot.findMany({
		where: { dayClosing: { business_date: { gte: start, lte: end }, status: "CLOSED" } },
		include: {
			item:       { select: { id: true, name: true, ml_per_unit: true, excise_rate: true } },
			dayClosing: { select: { business_date: true } }
		},
		orderBy: { dayClosing: { business_date: "asc" } }
	});

	// Group by item
	const itemMap = new Map<number, any>();
	for (const s of snapshots) {
		const id = s.item_id;
		if (!itemMap.has(id)) {
			itemMap.set(id, {
				item_id:          id,
				brand_name:       s.item.name,
				ml_per_unit:      s.item.ml_per_unit,
				excise_rate:      s.item.excise_rate ?? 0,
				daily_variances:  [],
				total_variance_ml: 0,
			});
		}
		const rec = itemMap.get(id);
		rec.total_variance_ml += s.variance_ml;
		rec.daily_variances.push({
			date:          s.dayClosing.business_date,
			variance_ml:   s.variance_ml,
			theoretical_ml: s.theoretical_ml,
			actual_ml:     s.open_bottles_ml,
		});
	}

	const brands = [...itemMap.values()].map((r) => ({
		...r,
		total_variance_ml: +r.total_variance_ml.toFixed(2),
		flagged:           Math.abs(r.total_variance_ml) > thresholdMl
	})).sort((a, b) => Math.abs(b.total_variance_ml) - Math.abs(a.total_variance_ml));

	const flagged = brands.filter(b => b.flagged);

	return {
		report_name:       "Stock Variance Report",
		from,
		to,
		threshold_ml:      thresholdMl,
		generated_at:      new Date().toISOString(),
		summary: {
			total_brands:    brands.length,
			flagged_brands:  flagged.length
		},
		flagged_brands:    flagged,
		all_brands:        brands
	};
}

// ============================================================
// PURCHASE REGISTER WITH EXCISE (enhanced)
// Includes is_duty_paid, batch numbers, excise rates.
// ============================================================
export async function excisePurchaseRegister(from?: string, to?: string, vendorId?: number) {
	const start = from ? new Date(from) : new Date("2000-01-01");
	const end   = to   ? new Date(to)   : new Date();
	end.setHours(23, 59, 59, 999);

	const purchases = await prisma.purchase.findMany({
		where: {
			purchase_date: { gte: start, lte: end },
			...(vendorId ? { vendor_id: vendorId } : {})
		},
		include: {
			vendor: true,
			purchaseBatches: {
				include: {
					item: { select: { id: true, name: true, is_liquor: true, ml_per_unit: true, excise_rate: true } }
				}
			},
			purchasePayments: true
		},
		orderBy: { purchase_date: "asc" }
	});

	const rows = purchases.map((p) => {
		const totalPaid = p.purchasePayments.reduce((s, pp) => s + pp.amount, 0);
		return {
			purchase_id:      p.id,
			invoice_no:       p.invoice_no,
			purchase_date:    p.purchase_date,
			vendor_name:      p.vendor.name,
			total_amount:     p.total_amount,
			amount_paid:      totalPaid,
			outstanding:      p.total_amount - totalPaid,
			payment_status:   p.payment_status,
			batches: p.purchaseBatches.map((b) => ({
				item_id:       b.item_id,
				brand_name:    b.item.name,
				is_liquor:     b.item.is_liquor,
				ml_per_unit:   b.item.ml_per_unit,
				excise_rate:   b.item.excise_rate ?? 0,
				qty_purchased: b.qty_total,
				cost_price:    b.cost_price,
				batch_number:  b.batch_number,
				expiry_date:   b.expiry_date,
				is_duty_paid:  b.is_duty_paid,
				pack_size:     b.pack_size,
				ml_per_bottle: b.ml_per_bottle,
				scheme_qty:    b.scheme_qty ?? 0
			}))
		};
	});

	const totalLiquorPurchases = rows.reduce((s, r) =>
		s + r.batches.filter(b => b.is_liquor).reduce((ss, b) => ss + b.cost_price * b.qty_purchased, 0), 0
	);
	const totalFoodPurchases = rows.reduce((s, r) =>
		s + r.batches.filter(b => !b.is_liquor).reduce((ss, b) => ss + b.cost_price * b.qty_purchased, 0), 0
	);

	return {
		report_name:    "Purchase Register (Excise)",
		from:           from ?? "all",
		to:             to   ?? "all",
		generated_at:   new Date().toISOString(),
		summary: {
			total_purchases:          rows.length,
			total_liquor_purchases:   +totalLiquorPurchases.toFixed(2),
			total_food_purchases:     +totalFoodPurchases.toFixed(2),
			total_outstanding:        rows.reduce((s, r) => s + r.outstanding, 0)
		},
		purchases: rows
	};
}
