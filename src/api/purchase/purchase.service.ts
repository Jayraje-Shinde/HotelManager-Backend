import prisma from "../../config/db";
import { CreatePurchaseInput, PurchaseItemInput } from "../../types/purchase";

/**
 * Create a purchase:
 * - create Purchase
 * - for each item: create PurchaseItem, PurchaseBatch (paid)
 * - if scheme_qty > 0 -> create separate PurchaseItem (scheme) & separate PurchaseBatch (cost 0)
 * - update item.stock (if manage_stock true)
 * - create StockMovement entries (movement_type = PURCHASE)
 *
 * Returns created purchase with batches/items.
 */
export async function createPurchase(payload: CreatePurchaseInput) {
	if (!payload.items || payload.items.length === 0) {
		throw new Error("Purchase must contain at least one item");
	}

	// compute totals from items
	let computedTotal = 0;
	for (const it of payload.items) {
		computedTotal += (it.quantity * it.cost_price);
		// scheme items cost 0 (not added)
	}

	const purchaseDate = payload.purchase_date ? new Date(payload.purchase_date) : new Date();


	const invoice = await prisma.purchase.findUnique({ where: { invoice_no: payload.invoice_no } });
	if (invoice) throw new Error("invoice already exists");
	const result = await prisma.$transaction(async (tx) => {
		// create Purchase (temporarily total_amount = computedTotal or provided)
		const purchase = await tx.purchase.create({
			data: {
				vendor_id: payload.vendor_id,
				invoice_no: payload.invoice_no,
				purchase_date: purchaseDate,
				total_amount: payload.total_amount ?? computedTotal,
				created_by: payload.created_by ?? null
			}
		});

		// For collecting created batches to return
		const createdBatches: any[] = [];
		const createdItems: any[] = [];

		for (const it of payload.items) {
			// create the paid PurchaseItem row
			const paidPi = await tx.purchaseItem.create({
				data: {
					purchase_id: purchase.id,
					item_id: it.item_id,
					quantity: it.quantity,
					price: it.cost_price
				}
			});
			createdItems.push(paidPi);

			// create paid PurchaseBatch
			const paidBatch = await tx.purchaseBatch.create({
				data: {
					item_id: it.item_id,
					purchase_id: purchase.id,
					qty_total: it.quantity,
					qty_remaining: it.quantity,
					cost_price: it.cost_price,
					pack_size: it.pack_size ?? 1,
					ml_per_bottle: undefined,
					batch_number: it.batch_number ?? null,
					expiry_date: it.expiry_date ? new Date(it.expiry_date) : null,
					created_at: new Date()
				}
			});
			createdBatches.push(paidBatch);

			// Update item stock if manage_stock true (increase by paid quantity)
			const item = await tx.item.findUnique({ where: { id: it.item_id } });
			if (!item) throw new Error(`Item ${it.item_id} not found`);

			if (item.manage_stock) {
				// current stock may be null for some items; treat null as 0
				const newStock = (item.stock ?? 0) + it.quantity + (it.scheme_qty ?? 0);
				await tx.item.update({
					where: { id: it.item_id },
					data: { stock: newStock }
				});
			}

			// Create StockMovement for paid qty
			await tx.stockMovement.create({
				data: {
					item_id: it.item_id,
					change_qty: it.quantity,
					reason: `Purchase ${purchase.invoice_no}`,
					movement_type: "PURCHASE",
					ref_id: purchase.id,
					created_by: payload.created_by ?? null,
					created_at: new Date()
				}
			});

			// If scheme_qty exists and > 0 -> create separate PurchaseItem and PurchaseBatch with cost_price = 0
			const freeQty = it.scheme_qty ?? 0;
			if (freeQty > 0) {
				const freePi = await tx.purchaseItem.create({
					data: {
						purchase_id: purchase.id,
						item_id: it.item_id,
						quantity: freeQty,
						price: 0
					}
				});
				createdItems.push(freePi);

				const freeBatch = await tx.purchaseBatch.create({
					data: {
						item_id: it.item_id,
						purchase_id: purchase.id,
						qty_total: freeQty,
						qty_remaining: freeQty,
						cost_price: 0,
						pack_size: it.pack_size ?? 1,
						ml_per_bottle: undefined,
						batch_number: (it.batch_number ? `${it.batch_number}_FREE` : "FREE"),
						expiry_date: it.expiry_date ? new Date(it.expiry_date) : null,
						created_at: new Date()
					}
				});
				createdBatches.push(freeBatch);

				// StockMovement for free qty (still increases stock)
				await tx.stockMovement.create({
					data: {
						item_id: it.item_id,
						change_qty: freeQty,
						reason: `Purchase (free) ${purchase.invoice_no}`,
						movement_type: "PURCHASE",
						ref_id: purchase.id,
						created_by: payload.created_by ?? null,
						created_at: new Date()
					}
				});
			}
		} // end loop items

		// Stamp computed and provided amounts: store both by updating record
		const finalTotal = payload.total_amount ?? computedTotal;
		await tx.purchase.update({
			where: { id: purchase.id },
			data: {
				total_amount: finalTotal
			}
		});

		// Return a composed response
		const full = await tx.purchase.findUnique({
			where: { id: purchase.id },
			include: {
				items: true,
				purchaseBatches: true,
				vendor: true,
				user: true
			}
		});

		return full;
	}); // end transaction

	return result;
}

/**
 * get purchases (list)
 */
export async function getAllPurchases() {
	return prisma.purchase.findMany({
		orderBy: { id: "desc" },
		include: { items: true, purchaseBatches: true, vendor: true, user: true }
	});
}

/**
 * get purchase by id
 */
export async function getPurchaseById(id: number) {
	return prisma.purchase.findUnique({
		where: { id },
		include: { items: true, purchaseBatches: true, vendor: true, user: true }
	});
}
