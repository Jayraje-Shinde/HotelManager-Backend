import prisma from "../../../config/db";

export async function salesRegister(start?: string, end?: string, userId?: number) {
	// CASE 1: no start & no end → fetch all bills
	if (!start && !end) {
		const bills = await prisma.bill.findMany({
			include: {
				user: true,
				items: { include: { item: true, batches: true, shotUsage: true } },
				payments: true
			},
			orderBy: { bill_date: "asc" }
		});

		return formatBills(bills);
	}

	// CASE 2: start but no end → end = today 23:59:59
	if (start && !end) {
		end = new Date().toISOString().slice(0, 10);
	}

	// CASE 3: end but no start → invalid
	if (!start && end) {
		throw new Error("Start date required when end date is provided");
	}

	// Normal case: start + end
	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const bills = await prisma.bill.findMany({
		where: {
			bill_date: { gte: from, lte: to },
			...(userId ? { user_id: userId } : {})
		},
		include: {
			user: true,
			items: { include: { item: true, batches: true, shotUsage: true } },
			payments: true
		},
		orderBy: { bill_date: "asc" }
	});

	return formatBills(bills);
}


// --------------------------------------
// Helper formatting function
// --------------------------------------
function formatBills(bills: any[]) {
	return bills.map(b => {
		const itemLines = b.items.map((bi: any) => ({
			item_id: bi.item_id,
			item_name: bi.item.name,
			quantity: bi.quantity,
			rate: bi.rate,
			subtotal: bi.subtotal,
			is_liquor: bi.item.is_liquor,
			shot_count: bi.shotUsage?.length ?? 0,
			batches_used: bi.batches?.map((bb: any) => ({
				batch_id: bb.purchase_batch_id,
				qty_used: bb.qty_used,
				cost_price: bb.cost_price_at_use,
				ml_used: bb.ml_used
			})) ?? []
		}));

		const paymentLines = b.payments.map((p: any) => ({
			payment_id: p.id,
			method: p.method,
			amount: p.amount,
			reference: p.referenceNo,
			created_at: p.created_at
		}));

		const total_items_value = itemLines.reduce((s, x) => s + x.subtotal, 0);
		const total_payment_value = paymentLines.reduce((s, x) => s + x.amount, 0);

		return {
			bill_id: b.id,
			table_no: b.table_no,
			cashier_name: b.user?.name ?? "",
			cashier_id: b.user_id,
			bill_date: b.bill_date,
			status: b.status,
			total_amount: b.total,
			discount: b.discount,
			calculated_total: total_items_value,
			payment_total: total_payment_value,
			items: itemLines,
			payments: paymentLines
		};
	});
}
