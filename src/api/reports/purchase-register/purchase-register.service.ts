import prisma from "../../../config/db";

export async function purchaseRegister(start?: string, end?: string, vendorId?: number) {

	// CASE 1: No start & no end → return everything
	if (!start && !end) {
		const purchases = await prisma.purchase.findMany({
			include: {
				vendor: true,
				items: { include: { item: true } },
				purchaseBatches: { include: { item: true } }
			},
			orderBy: { purchase_date: "asc" }
		});

		return formatPurchases(purchases);
	}

	// CASE 2: end missing but start provided → end = today's end of day
	if (start && !end) {
		end = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
	}

	// CASE 3: end provided but start missing → invalid
	if (!start && end) {
		throw new Error("Start date required when end date is provided");
	}

	// Normal flow (start + end)
	const from = new Date(start!);
	const to = new Date(end!);
	to.setHours(23, 59, 59, 999);

	const purchases = await prisma.purchase.findMany({
		where: {
			purchase_date: { gte: from, lte: to },
			...(vendorId ? { vendor_id: vendorId } : {})
		},
		include: {
			vendor: true,
			items: { include: { item: true } },
			purchaseBatches: { include: { item: true } }
		},
		orderBy: { purchase_date: "asc" }
	});

	return formatPurchases(purchases);
}


// Helper function to keep code clean
function formatPurchases(purchases: any[]) {
	return purchases.map(p => {
		const itemLines = p.items.map(pi => ({
			item_id: pi.item_id,
			item_name: pi.item.name,
			quantity: pi.quantity,
			rate: pi.price,
			subtotal: pi.quantity * pi.price
		}));

		const batchLines = p.purchaseBatches.map(b => ({
			batch_id: b.id,
			item_id: b.item_id,
			item_name: b.item.name,
			qty_total: b.qty_total,
			scheme_qty: b.scheme_qty ?? 0,
			cost_price: b.cost_price,
			pack_size: b.pack_size,
			ml_per_bottle: b.ml_per_bottle,
			is_duty_paid: b.is_duty_paid,
			batch_number: b.batch_number,
			expiry_date: b.expiry_date
		}));

		const total_items_value = itemLines.reduce((s, line) => s + line.subtotal, 0);

		return {
			purchase_id: p.id,
			invoice_no: p.invoice_no,
			vendor_name: p.vendor?.name ?? "",
			vendor_id: p.vendor_id,
			purchase_date: p.purchase_date,
			total_amount: p.total_amount,
			calculated_total: total_items_value,
			items: itemLines,
			batches: batchLines
		};
	});
}
