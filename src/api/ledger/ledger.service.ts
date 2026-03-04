import prisma from "../../config/db";

function parseRange(from?: string, to?: string) {
	const start = from ? new Date(from) : new Date("2000-01-01");
	const end   = to   ? new Date(to)   : new Date();
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

// ============================================================
// VENDOR LEDGER
// Full debit/credit statement for a single vendor
// ============================================================
export async function getVendorLedger(vendorId: number, from?: string, to?: string) {
	const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
	if (!vendor) throw new Error("Vendor not found");

	const { start, end } = parseRange(from, to);

	// All purchases (credit — we owe them)
	const purchases = await prisma.purchase.findMany({
		where: {
			vendor_id:     vendorId,
			purchase_date: { gte: start, lte: end }
		},
		include: { purchasePayments: true },
		orderBy: { purchase_date: "asc" }
	});

	// Build ledger entries
	const entries: any[] = [];

	for (const p of purchases) {
		// Purchase entry — CREDIT (money we owe)
		entries.push({
			date:        p.purchase_date,
			type:        "PURCHASE",
			ref:         p.invoice_no,
			description: `Purchase - Invoice ${p.invoice_no}`,
			debit:       0,
			credit:      p.total_amount,
			status:      p.payment_status
		});

		// Each payment against this purchase — DEBIT (money we paid)
		for (const pp of p.purchasePayments) {
			if (pp.created_at >= start && pp.created_at <= end) {
				entries.push({
					date:        pp.created_at,
					type:        "PAYMENT",
					ref:         `PAY-${pp.id}`,
					description: pp.note ?? `Payment for Invoice ${p.invoice_no}`,
					method:      pp.method,
					reference:   pp.reference ?? null,
					debit:       pp.amount,
					credit:      0
				});
			}
		}
	}

	// Sort all entries chronologically
	entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	// Running balance (positive = we still owe, negative = overpaid)
	let balance = 0;
	for (const e of entries) {
		balance += e.credit - e.debit;
		e.balance = balance;
	}

	// Summary
	const totalPurchased  = purchases.reduce((s, p) => s + p.total_amount, 0);
	const totalPaid       = purchases.reduce((s, p) =>
		s + p.purchasePayments.reduce((ss, pp) => ss + pp.amount, 0), 0
	);
	const outstanding     = totalPurchased - totalPaid;

	// Aging buckets (days since purchase, for CREDIT/PARTIAL only)
	const today = new Date();
	const aging = { current: 0, days_30: 0, days_60: 0, days_90_plus: 0 };
	for (const p of purchases) {
		if (p.payment_status === "PAID") continue;
		const paid  = p.purchasePayments.reduce((s, pp) => s + pp.amount, 0);
		const due   = p.total_amount - paid;
		const days  = Math.floor((today.getTime() - new Date(p.purchase_date).getTime()) / 86400000);
		if      (days <= 30)  aging.current    += due;
		else if (days <= 60)  aging.days_30    += due;
		else if (days <= 90)  aging.days_60    += due;
		else                  aging.days_90_plus += due;
	}

	return {
		vendor: { id: vendor.id, name: vendor.name, contact: vendor.contact },
		summary: {
			total_purchased: totalPurchased,
			total_paid:      totalPaid,
			outstanding,
			aging
		},
		entries
	};
}

// ============================================================
// CUSTOMER LEDGER
// Full debit/credit statement for a single customer
// ============================================================
export async function getCustomerLedger(customerId: number, from?: string, to?: string) {
	const customer = await prisma.customer.findUnique({ where: { id: customerId } });
	if (!customer) throw new Error("Customer not found");

	const { start, end } = parseRange(from, to);

	const bills = await prisma.bill.findMany({
		where: {
			customer_id: customerId,
			bill_date:   { gte: start, lte: end }
		},
		include: { payments: true },
		orderBy: { bill_date: "asc" }
	});

	const entries: any[] = [];

	for (const b of bills) {
		const billTotal = b.total - (b.discount ?? 0);

		// Bill entry — CREDIT (customer owes us)
		entries.push({
			date:        b.bill_date,
			type:        "BILL",
			ref:         `BILL-${b.id}`,
			description: `Bill - Table ${b.table_no}`,
			debit:       0,
			credit:      billTotal,
			status:      b.status
		});

		// Each payment — DEBIT (customer paid us)
		for (const p of b.payments) {
			if (p.created_at >= start && p.created_at <= end) {
				entries.push({
					date:        p.created_at,
					type:        "PAYMENT",
					ref:         `PAY-${p.id}`,
					description: p.note ?? `Payment for Bill ${b.id}`,
					method:      p.method,
					reference:   p.referenceNo ?? null,
					debit:       p.amount,
					credit:      0
				});
			}
		}
	}

	entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	let balance = 0;
	for (const e of entries) {
		balance += e.credit - e.debit;
		e.balance = balance;
	}

	const totalBilled  = bills.reduce((s, b) => s + (b.total - (b.discount ?? 0)), 0);
	const totalPaid    = bills.reduce((s, b) =>
		s + b.payments.reduce((ss, p) => ss + p.amount, 0), 0
	);
	const outstanding  = totalBilled - totalPaid;

	const today = new Date();
	const aging = { current: 0, days_30: 0, days_60: 0, days_90_plus: 0 };
	for (const b of bills) {
		if (b.status === "PAID") continue;
		const paid  = b.payments.reduce((s, p) => s + p.amount, 0);
		const due   = (b.total - (b.discount ?? 0)) - paid;
		const days  = Math.floor((today.getTime() - new Date(b.bill_date).getTime()) / 86400000);
		if      (days <= 30)  aging.current     += due;
		else if (days <= 60)  aging.days_30     += due;
		else if (days <= 90)  aging.days_60     += due;
		else                  aging.days_90_plus += due;
	}

	return {
		customer: {
			id:           customer.id,
			name:         customer.name,
			phone:        customer.phone,
			credit_limit: customer.credit_limit ?? null
		},
		summary: {
			total_billed: totalBilled,
			total_paid:   totalPaid,
			outstanding,
			aging
		},
		entries
	};
}

// ============================================================
// OUTSTANDING REPORT
// All vendors and customers with pending balances
// ============================================================
export async function getOutstandingReport() {
	// --- VENDOR SIDE ---
	const creditPurchases = await prisma.purchase.findMany({
		where:   { payment_status: { in: ["CREDIT", "PARTIAL"] } },
		include: { vendor: true, purchasePayments: true },
		orderBy: { purchase_date: "asc" }
	});

	const vendorMap = new Map<number, any>();
	for (const p of creditPurchases) {
		const paid      = p.purchasePayments.reduce((s, pp) => s + pp.amount, 0);
		const due       = p.total_amount - paid;
		const days      = Math.floor((Date.now() - new Date(p.purchase_date).getTime()) / 86400000);
		const vendorId  = p.vendor_id;

		if (!vendorMap.has(vendorId)) {
			vendorMap.set(vendorId, {
				vendor_id:   p.vendor.id,
				vendor_name: p.vendor.name,
				contact:     p.vendor.contact ?? null,
				total_due:   0,
				purchases:   []
			});
		}
		const v = vendorMap.get(vendorId);
		v.total_due += due;
		v.purchases.push({
			purchase_id:    p.id,
			invoice_no:     p.invoice_no,
			purchase_date:  p.purchase_date,
			total_amount:   p.total_amount,
			amount_paid:    paid,
			amount_due:     due,
			payment_status: p.payment_status,
			days_outstanding: days
		});
	}

	// --- CUSTOMER SIDE ---
	const creditBills = await prisma.bill.findMany({
		where:   { status: { in: ["CREDIT", "CLOSED"] } },
		include: { customer: true, payments: true },
		orderBy: { bill_date: "asc" }
	});

	const customerMap = new Map<number, any>();
	for (const b of creditBills) {
		const billTotal = b.total - (b.discount ?? 0);
		const paid      = b.payments.reduce((s, p) => s + p.amount, 0);
		const due       = billTotal - paid;
		if (due <= 0.01) continue; // fully settled, skip

		const days       = Math.floor((Date.now() - new Date(b.bill_date).getTime()) / 86400000);
		const customerId = b.customer_id ?? 0;
		const customerName = b.customer?.name ?? "Walk-in / Unknown";

		if (!customerMap.has(customerId)) {
			customerMap.set(customerId, {
				customer_id:   customerId,
				customer_name: customerName,
				phone:         b.customer?.phone ?? null,
				total_due:     0,
				bills:         []
			});
		}
		const c = customerMap.get(customerId);
		c.total_due += due;
		c.bills.push({
			bill_id:          b.id,
			table_no:         b.table_no,
			bill_date:        b.bill_date,
			total_amount:     billTotal,
			amount_paid:      paid,
			amount_due:       due,
			status:           b.status,
			days_outstanding: days
		});
	}

	const vendors   = [...vendorMap.values()].sort((a, b) => b.total_due - a.total_due);
	const customers = [...customerMap.values()].sort((a, b) => b.total_due - a.total_due);

	return {
		summary: {
			total_vendor_payable:     vendors.reduce((s, v) => s + v.total_due, 0),
			total_customer_receivable: customers.reduce((s, c) => s + c.total_due, 0),
			vendor_count:             vendors.length,
			customer_count:           customers.length
		},
		vendors,
		customers
	};
}

// ============================================================
// AGING REPORT
// Buckets: current (0-30), 30-60, 60-90, 90+ days
// ============================================================
export async function getAgingReport() {
	const buckets = {
		current:      { label: "0-30 days",  vendor: 0, customer: 0 },
		days_30_60:   { label: "31-60 days", vendor: 0, customer: 0 },
		days_60_90:   { label: "61-90 days", vendor: 0, customer: 0 },
		days_90_plus: { label: "90+ days",   vendor: 0, customer: 0 }
	};

	const today = Date.now();

	// Vendor aging
	const vendorPurchases = await prisma.purchase.findMany({
		where:   { payment_status: { in: ["CREDIT", "PARTIAL"] } },
		include: { purchasePayments: true }
	});

	for (const p of vendorPurchases) {
		const paid = p.purchasePayments.reduce((s, pp) => s + pp.amount, 0);
		const due  = p.total_amount - paid;
		const days = Math.floor((today - new Date(p.purchase_date).getTime()) / 86400000);
		const bucket =
			days <= 30 ? "current" :
			days <= 60 ? "days_30_60" :
			days <= 90 ? "days_60_90" : "days_90_plus";
		buckets[bucket].vendor += due;
	}

	// Customer aging
	const customerBills = await prisma.bill.findMany({
		where:   { status: { in: ["CREDIT", "CLOSED"] } },
		include: { payments: true }
	});

	for (const b of customerBills) {
		const billTotal = b.total - (b.discount ?? 0);
		const paid      = b.payments.reduce((s, p) => s + p.amount, 0);
		const due       = billTotal - paid;
		if (due <= 0.01) continue;
		const days = Math.floor((today - new Date(b.bill_date).getTime()) / 86400000);
		const bucket =
			days <= 30 ? "current" :
			days <= 60 ? "days_30_60" :
			days <= 90 ? "days_60_90" : "days_90_plus";
		buckets[bucket].customer += due;
	}

	return {
		aging: Object.entries(buckets).map(([key, val]) => ({
			bucket:   key,
			label:    val.label,
			vendor_payable:     +val.vendor.toFixed(2),
			customer_receivable: +val.customer.toFixed(2),
			net:      +(val.customer - val.vendor).toFixed(2)
		}))
	};
}

// ============================================================
// ALL VENDORS SUMMARY (outstanding per vendor)
// ============================================================
export async function getAllVendorsSummary() {
	const vendors = await prisma.vendor.findMany({
		include: {
			purchases: {
				include: { purchasePayments: true }
			}
		},
		orderBy: { id: "asc" }
	});

	return vendors.map((v) => {
		const totalPurchased = v.purchases.reduce((s, p) => s + p.total_amount, 0);
		const totalPaid      = v.purchases.reduce((s, p) =>
			s + p.purchasePayments.reduce((ss, pp) => ss + pp.amount, 0), 0
		);
		const outstanding    = totalPurchased - totalPaid;
		const creditCount    = v.purchases.filter((p) => p.payment_status !== "PAID").length;

		return {
			vendor_id:         v.id,
			vendor_name:       v.name,
			contact:           v.contact ?? null,
			total_purchased:   totalPurchased,
			total_paid:        totalPaid,
			outstanding,
			pending_invoices:  creditCount
		};
	});
}
