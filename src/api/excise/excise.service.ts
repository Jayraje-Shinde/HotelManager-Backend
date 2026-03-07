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

// ============================================================
// FLR-3 — TOTAL ACCOUNT REGISTER (Daily aggregate, monthly view)
//
// Maharashtra Excise: FL3 permit rooms must maintain FLR-3
// alongside FLR-3/A. While FLR-3/A shows one row per brand
// per day, FLR-3 is the DAILY AGGREGATE — all IMFL brands
// combined into a single row per day. Officers use this to
// verify total movement at a glance before drilling into brands.
//
// Source: DayLiquorSnapshot (already computed at day-end close)
// ============================================================
export async function flr3(yearMonth: string) {
	const { start, end } = monthRange(yearMonth);

	const dayClosings = await prisma.dayClosing.findMany({
		where:   { business_date: { gte: start, lte: end }, status: "CLOSED" },
		include: {
			liquorSnapshots: {
				include: {
					item: {
						select: {
							id: true, name: true, ml_per_unit: true,
							category: { select: { name: true } }
						}
					}
				}
			}
		},
		orderBy: { business_date: "asc" }
	});

	const dailyRows: any[] = [];
	let runningClosingBottles = 0;
	let runningClosingMl      = 0;

	for (const dc of dayClosings) {
		// Separate IMFL from Beer for the daily aggregate
		// Beer is identified by category name or item name containing "beer"
		const imflSnapshots = dc.liquorSnapshots.filter((s) => {
			const catName  = s.item.category?.name?.toLowerCase() ?? "";
			const itemName = s.item.name?.toLowerCase() ?? "";
			return !catName.includes("beer") && !itemName.includes("beer");
		});

		if (imflSnapshots.length === 0) continue;

		const dayTotal = imflSnapshots.reduce((acc, s) => {
			const mlPerUnit          = s.item.ml_per_unit ?? 0;
			const shotsBottleEquiv   = mlPerUnit ? s.shots_ml_sold / mlPerUnit : 0;
			const closingBottles     = Math.max(0,
				Number(s.opening_bottles) + Number(s.purchased_bottles)
				- Number(s.sealed_sold) - Number(s.broken_bottles) - shotsBottleEquiv
			);

			acc.opening_bottles   += Number(s.opening_bottles);
			acc.purchased_bottles += Number(s.purchased_bottles);
			acc.sealed_sold       += Number(s.sealed_sold);
			acc.shots_ml_sold     += Number(s.shots_ml_sold);
			acc.broken_bottles    += Number(s.broken_bottles);
			acc.closing_bottles   += closingBottles;
			acc.open_bottles_ml   += Number(s.open_bottles_ml);
			acc.variance_ml       += Number(s.variance_ml);
			acc.brand_count       += 1;
			return acc;
		}, {
			opening_bottles:   0,
			purchased_bottles: 0,
			sealed_sold:       0,
			shots_ml_sold:     0,
			broken_bottles:    0,
			closing_bottles:   0,
			open_bottles_ml:   0,
			variance_ml:       0,
			brand_count:       0
		});

		runningClosingBottles = +dayTotal.closing_bottles.toFixed(3);
		runningClosingMl      = +dayTotal.open_bottles_ml.toFixed(2);

		dailyRows.push({
			date:                dc.business_date,
			opening_bottles:     +dayTotal.opening_bottles.toFixed(3),
			purchased_bottles:   +dayTotal.purchased_bottles.toFixed(3),
			sealed_sold:         +dayTotal.sealed_sold.toFixed(3),
			shots_ml_sold:       +dayTotal.shots_ml_sold.toFixed(2),
			broken_bottles:      +dayTotal.broken_bottles.toFixed(3),
			closing_bottles:     runningClosingBottles,
			open_bottles_ml:     runningClosingMl,
			variance_ml:         +dayTotal.variance_ml.toFixed(2),
			active_brands:       dayTotal.brand_count
		});
	}

	// Monthly aggregate totals
	const monthTotals = dailyRows.reduce((acc, r) => {
		acc.total_purchased   += r.purchased_bottles;
		acc.total_sealed_sold += r.sealed_sold;
		acc.total_shots_ml    += r.shots_ml_sold;
		acc.total_broken      += r.broken_bottles;
		acc.total_variance_ml += r.variance_ml;
		return acc;
	}, {
		total_purchased: 0, total_sealed_sold: 0,
		total_shots_ml: 0,  total_broken: 0, total_variance_ml: 0
	});

	return {
		register:      "FLR-3",
		month:         yearMonth,
		report_name:   "Total Account Register (IMFL Daily Aggregate)",
		note:          "One row per day — all IMFL brands combined. Beer tracked separately in BEER-A register.",
		generated_at:  new Date().toISOString(),
		days_closed:   dailyRows.length,
		monthly_totals: {
			total_purchased_bottles:  +monthTotals.total_purchased.toFixed(3),
			total_sealed_sold:        +monthTotals.total_sealed_sold.toFixed(3),
			total_shots_ml_sold:      +monthTotals.total_shots_ml.toFixed(2),
			total_broken_bottles:     +monthTotals.total_broken.toFixed(3),
			total_variance_ml:        +monthTotals.total_variance_ml.toFixed(2),
			closing_bottles_eom:      runningClosingBottles,
			closing_open_bottles_ml:  runningClosingMl
		},
		daily_entries: dailyRows
	};
}

// ============================================================
// BEER-A — BEER STOCK REGISTER
//
// Maharashtra Excise requires a SEPARATE register for beer
// (including draught beer, cans, and bottled beer) under FL3.
// BEER-A mirrors the FLR-1/A structure but covers ONLY beer
// items. Beer is identified by category name or item name
// containing "beer" (case-insensitive).
//
// If no beer items exist in your system, returns an empty
// register with a note — not an error.
// ============================================================
export async function beerA(yearMonth: string) {
	const { start, end } = monthRange(yearMonth);

	// Identify beer items by category or name
	const beerItems = await prisma.item.findMany({
		where: {
			is_liquor: true,
			OR: [
				{ name:     { contains: "beer", mode: "insensitive" } },
				{ category: { name: { contains: "beer", mode: "insensitive" } } }
			]
		},
		include: { category: { select: { name: true } } },
		orderBy: { name: "asc" }
	});

	if (beerItems.length === 0) {
		return {
			register:     "BEER-A",
			month:        yearMonth,
			report_name:  "Beer Stock Register",
			generated_at: new Date().toISOString(),
			note:         "No beer items found. To enable this register, ensure beer items have 'beer' in their name or are in a category named 'Beer'.",
			beer_items:   [],
			daily_entries: []
		};
	}

	const beerItemIds = beerItems.map((i) => i.id);

	// Pull day closings for the month
	const dayClosings = await prisma.dayClosing.findMany({
		where:   { business_date: { gte: start, lte: end }, status: "CLOSED" },
		include: {
			liquorSnapshots: {
				where:   { item_id: { in: beerItemIds } },
				include: { item: { select: { id: true, name: true, ml_per_unit: true } } }
			}
		},
		orderBy: { business_date: "asc" }
	});

	// Per-brand monthly aggregates
	const brandMap = new Map<number, any>();

	for (const item of beerItems) {
		brandMap.set(item.id, {
			item_id:           item.id,
			brand_name:        item.name,
			ml_per_unit:       item.ml_per_unit,
			category:          item.category?.name,
			opening_bottles:   0,  // first day's opening
			purchased_bottles: 0,
			sealed_sold:       0,
			shots_ml_sold:     0,
			broken_bottles:    0,
			closing_bottles:   0,
			open_bottles_ml:   0,
			total_variance_ml: 0,
			first_seen:        false
		});
	}

	const dailyRows: any[] = [];

	for (const dc of dayClosings) {
		if (dc.liquorSnapshots.length === 0) continue;

		const dayEntries: any[] = [];

		for (const s of dc.liquorSnapshots) {
			const mlPerUnit        = s.item.ml_per_unit ?? 0;
			const shotsBottleEquiv = mlPerUnit ? Number(s.shots_ml_sold) / mlPerUnit : 0;
			const closingBottles   = Math.max(0,
				Number(s.opening_bottles) + Number(s.purchased_bottles)
				- Number(s.sealed_sold) - Number(s.broken_bottles) - shotsBottleEquiv
			);

			// Accumulate brand totals
			const brand = brandMap.get(s.item_id);
			if (brand) {
				if (!brand.first_seen) {
					brand.opening_bottles = Number(s.opening_bottles);
					brand.first_seen      = true;
				}
				brand.purchased_bottles += Number(s.purchased_bottles);
				brand.sealed_sold       += Number(s.sealed_sold);
				brand.shots_ml_sold     += Number(s.shots_ml_sold);
				brand.broken_bottles    += Number(s.broken_bottles);
				brand.closing_bottles    = +closingBottles.toFixed(3);
				brand.open_bottles_ml    = Number(s.open_bottles_ml);
				brand.total_variance_ml += Number(s.variance_ml);
			}

			dayEntries.push({
				brand_name:       s.item.name,
				item_id:          s.item_id,
				ml_per_unit:      s.item.ml_per_unit,
				opening_bottles:  +Number(s.opening_bottles).toFixed(3),
				purchased:        +Number(s.purchased_bottles).toFixed(3),
				sealed_sold:      +Number(s.sealed_sold).toFixed(3),
				shots_ml_sold:    +Number(s.shots_ml_sold).toFixed(2),
				broken_bottles:   +Number(s.broken_bottles).toFixed(3),
				closing_bottles:  +closingBottles.toFixed(3),
				open_bottles_ml:  +Number(s.open_bottles_ml).toFixed(2),
				variance_ml:      +Number(s.variance_ml).toFixed(2)
			});
		}

		dailyRows.push({
			date:    dc.business_date,
			brands:  dayEntries
		});
	}

	const brandSummaries = [...brandMap.values()]
		.filter(b => b.purchased_bottles > 0 || b.sealed_sold > 0 || b.opening_bottles > 0)
		.map(b => ({
			...b,
			purchased_bottles: +b.purchased_bottles.toFixed(3),
			sealed_sold:       +b.sealed_sold.toFixed(3),
			shots_ml_sold:     +b.shots_ml_sold.toFixed(2),
			broken_bottles:    +b.broken_bottles.toFixed(3),
			closing_bottles:   +b.closing_bottles.toFixed(3),
			total_variance_ml: +b.total_variance_ml.toFixed(2),
			first_seen:        undefined  // clean up internal flag
		}));

	return {
		register:      "BEER-A",
		month:         yearMonth,
		report_name:   "Beer Stock Register",
		generated_at:  new Date().toISOString(),
		note:          "Covers all items identified as beer by name or category. IMFL tracked separately in FLR-1/A.",
		beer_brands:   beerItems.map(i => ({ id: i.id, name: i.name, ml_per_unit: i.ml_per_unit })),
		brand_summary: brandSummaries,
		daily_entries: dailyRows
	};
}

// ============================================================
// VAT LIABILITY REPORT — Monthly, for CA / Accountant
//
// Uses the stored cgst_amount, sgst_amount, vat_amount fields
// on BillItem (snapshotted at KOT close time — zero recalculation).
//
// Three sections:
//   1. Monthly summary  — total tax collected by type
//   2. Weekly breakdown — week-by-week tax liability
//   3. Rate-wise table  — GST @ 5%, GST @ 18% etc. separately
//
// Important for CA:
//   - GST (CGST + SGST) applies to FOOD only
//   - VAT applies to LIQUOR only (Maharashtra FL3 = 10%)
//   - Prices are INCLUSIVE — tax shown here was extracted,
//     not charged on top. Customer always paid bill.total.
//   - File GSTR-1 monthly for food GST liability.
//   - VAT is deposited separately to Maharashtra excise dept.
// ============================================================
export async function vatLiabilityReport(yearMonth: string) {
	const { start, end } = monthRange(yearMonth);

	// Pull all paid/credit bills for the month with their items
	const bills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: start, lte: end },
			status:    { in: ["PAID", "CREDIT"] }
		},
		include: {
			items: {
				include: {
					item: {
						select: {
							id: true, name: true, is_liquor: true,
							tax_rate: true, vat_rate: true
						}
					}
				}
			},
			payments: true
		},
		orderBy: { bill_date: "asc" }
	});

	// ── Monthly aggregate ──────────────────────────────────────
	let total_food_sales      = 0;
	let total_liquor_sales    = 0;
	let total_cgst_collected  = 0;
	let total_sgst_collected  = 0;
	let total_vat_collected   = 0;

	// Rate-wise GST breakdown (for GSTR-1 filing)
	const gstRateMap = new Map<string, {
		rate: number; taxable_value: number;
		cgst: number; sgst: number; total_tax: number; bill_count: number
	}>();

	// Weekly breakdown
	const weekMap = new Map<string, {
		week_label:         string;
		week_start:         Date;
		week_end:           Date;
		food_sales:         number;
		liquor_sales:       number;
		cgst_collected:     number;
		sgst_collected:     number;
		vat_collected:      number;
		bills_count:        number;
	}>();

	// Bill-level detail (for CA to cross-check)
	const billDetails: any[] = [];

	for (const bill of bills) {
		let bill_food_sales    = 0;
		let bill_liquor_sales  = 0;
		let bill_cgst          = 0;
		let bill_sgst          = 0;
		let bill_vat           = 0;

		for (const bi of bill.items) {
			const subtotal    = Number(bi.subtotal);
			const cgst_amount = Number(bi.cgst_amount ?? 0);
			const sgst_amount = Number(bi.sgst_amount ?? 0);
			const vat_amount  = Number(bi.vat_amount  ?? 0);
			const cgst_rate   = Number(bi.cgst_rate   ?? 0);
			const sgst_rate   = Number(bi.sgst_rate   ?? 0);

			if (bi.item.is_liquor) {
				bill_liquor_sales  += subtotal;
				bill_vat           += vat_amount;
				total_liquor_sales += subtotal;
				total_vat_collected += vat_amount;
			} else {
				bill_food_sales    += subtotal;
				bill_cgst          += cgst_amount;
				bill_sgst          += sgst_amount;
				total_food_sales   += subtotal;
				total_cgst_collected += cgst_amount;
				total_sgst_collected += sgst_amount;

				// Rate-wise GST grouping
				const gstRate    = (cgst_rate + sgst_rate);   // e.g. 5 for 5% GST
				const rateKey    = `GST_${gstRate}`;
				const taxableVal = subtotal - cgst_amount - sgst_amount;

				if (!gstRateMap.has(rateKey)) {
					gstRateMap.set(rateKey, {
						rate:          gstRate,
						taxable_value: 0,
						cgst:          0,
						sgst:          0,
						total_tax:     0,
						bill_count:    0
					});
				}
				const rateEntry = gstRateMap.get(rateKey)!;
				rateEntry.taxable_value += taxableVal;
				rateEntry.cgst          += cgst_amount;
				rateEntry.sgst          += sgst_amount;
				rateEntry.total_tax     += cgst_amount + sgst_amount;
				rateEntry.bill_count    += 1;
			}
		}

		// Week label: Week 1, Week 2 etc. within the month
		const billDate   = new Date(bill.bill_date);
		const dayOfMonth = billDate.getDate();
		const weekNo     = Math.ceil(dayOfMonth / 7);
		const weekStart  = new Date(billDate);
		weekStart.setDate(dayOfMonth - ((dayOfMonth - 1) % 7));
		const weekEnd    = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		const weekKey    = `W${weekNo}`;

		if (!weekMap.has(weekKey)) {
			weekMap.set(weekKey, {
				week_label:     `Week ${weekNo} (${weekStart.toISOString().slice(0,10)} – ${weekEnd.toISOString().slice(0,10)})`,
				week_start:     weekStart,
				week_end:       weekEnd,
				food_sales:     0,
				liquor_sales:   0,
				cgst_collected: 0,
				sgst_collected: 0,
				vat_collected:  0,
				bills_count:    0
			});
		}
		const week = weekMap.get(weekKey)!;
		week.food_sales     += bill_food_sales;
		week.liquor_sales   += bill_liquor_sales;
		week.cgst_collected += bill_cgst;
		week.sgst_collected += bill_sgst;
		week.vat_collected  += bill_vat;
		week.bills_count    += 1;

		const totalPaid = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
		billDetails.push({
			bill_id:       bill.id,
			bill_date:     bill.bill_date,
			table_no:      bill.table_no,
			gross_total:   +Number(bill.total).toFixed(2),
			discount:      +Number(bill.discount ?? 0).toFixed(2),
			net_payable:   +(Number(bill.total) - Number(bill.discount ?? 0)).toFixed(2),
			amount_paid:   +totalPaid.toFixed(2),
			food_sales:    +bill_food_sales.toFixed(2),
			liquor_sales:  +bill_liquor_sales.toFixed(2),
			cgst_amount:   +bill_cgst.toFixed(2),
			sgst_amount:   +bill_sgst.toFixed(2),
			vat_amount:    +bill_vat.toFixed(2),
			status:        bill.status
		});
	}

	// Round all aggregates
	const summary = {
		month:                  yearMonth,
		total_bills:            bills.length,

		// Food / GST
		food_gross_sales:       +total_food_sales.toFixed(2),
		food_cgst_collected:    +total_cgst_collected.toFixed(2),
		food_sgst_collected:    +total_sgst_collected.toFixed(2),
		food_total_gst:         +(total_cgst_collected + total_sgst_collected).toFixed(2),
		food_taxable_value:     +(total_food_sales - total_cgst_collected - total_sgst_collected).toFixed(2),

		// Liquor / VAT
		liquor_gross_sales:     +total_liquor_sales.toFixed(2),
		liquor_vat_collected:   +total_vat_collected.toFixed(2),
		liquor_taxable_value:   +(total_liquor_sales - total_vat_collected).toFixed(2),

		// Grand
		grand_total_sales:      +(total_food_sales + total_liquor_sales).toFixed(2),
		total_tax_collected:    +(total_cgst_collected + total_sgst_collected + total_vat_collected).toFixed(2),
	};

	const gstRateBreakdown = [...gstRateMap.values()]
		.sort((a, b) => a.rate - b.rate)
		.map(r => ({
			gst_rate:      `${r.rate}%`,
			taxable_value: +r.taxable_value.toFixed(2),
			cgst_amount:   +r.cgst.toFixed(2),
			sgst_amount:   +r.sgst.toFixed(2),
			total_gst:     +r.total_tax.toFixed(2),
		}));

	const weeklyBreakdown = [...weekMap.values()]
		.sort((a, b) => a.week_start.getTime() - b.week_start.getTime())
		.map(w => ({
			week_label:         w.week_label,
			bills_count:        w.bills_count,
			food_sales:         +w.food_sales.toFixed(2),
			liquor_sales:       +w.liquor_sales.toFixed(2),
			cgst_collected:     +w.cgst_collected.toFixed(2),
			sgst_collected:     +w.sgst_collected.toFixed(2),
			vat_collected:      +w.vat_collected.toFixed(2),
			total_tax:          +(w.cgst_collected + w.sgst_collected + w.vat_collected).toFixed(2)
		}));

	return {
		report_name:   "VAT & GST Liability Report",
		month:         yearMonth,
		generated_at:  new Date().toISOString(),
		note: [
			"All amounts are extracted from inclusive prices — customers were never charged extra.",
			"Food sales are subject to GST. File GSTR-1 monthly for CGST + SGST liability.",
			"Liquor sales are subject to Maharashtra State VAT (FL3 rate: 10%). Deposit to excise dept separately.",
			"Items with 0% tax rate (packaged MRP items) are included in food_gross_sales but not in taxable_value."
		],
		summary,
		gst_rate_breakdown: gstRateBreakdown,
		weekly_breakdown:   weeklyBreakdown,
		bill_details:       billDetails
	};
}
