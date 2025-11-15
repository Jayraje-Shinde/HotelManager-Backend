import prisma from "../../config/db";

import { PurchaseItemInput, CreatePurchaseInput } from '../../types/purchase'

export async function createPurchase(data: CreatePurchaseInput) {
	// Prevent duplicate invoice numbers
	const existingInvoice = await prisma.purchase.findUnique({
		where: { invoice_no: data.invoice_no }
	});
	if (existingInvoice) throw new Error("Invoice number already exists");

	// Create purchase + items in one transaction
	const purchase = await prisma.$transaction(async (tx) => {
		const purchaseRecord = await tx.purchase.create({
			data: {
				vendor_id: data.vendor_id,
				invoice_no: data.invoice_no,
				purchase_date: new Date(data.purchase_date),
				total_amount: 0,
				created_by: data.created_by ?? null
			}
		});

		let totalAmount = 0;

		for (const pItem of data.items) {
			const item = await tx.item.findUnique({ where: { id: pItem.item_id } });
			if (!item) throw new Error(`Item not found: ${pItem.item_id}`);

			// Insert PurchaseItem
			await tx.purchaseItem.create({
				data: {
					purchase_id: purchaseRecord.id,
					item_id: pItem.item_id,
					quantity: pItem.quantity,
					price: pItem.price
				}
			});

			totalAmount += pItem.quantity * pItem.price;

			// -------- STOCK UPDATE --------
			if (item.manage_stock) {
				const newStock = (item.stock ?? 0) + pItem.quantity;

				await tx.item.update({
					where: { id: item.id },
					data: {
						stock: newStock,
						purchase_price: pItem.price,  // update last purchase price
					}
				});
			}

			// -------- LIQUOR LOGIC --------  
			// If this item is a liquor bottle parent → update ml_per_unit price logic for variants
			if (item.is_liquor && item.ml_per_unit && !item.variant_ml) {
				const variants = await tx.item.findMany({
					where: { parent_id: item.id }
				});

				// update selling price for variants ONLY if owner did not set custom price
				for (const v of variants) {
					const customFieldMap: Record<number, number | null | undefined> = {
						30: item.price_30ml,
						60: item.price_60ml,
						90: item.price_90ml,
						180: item.price_180ml,
						375: item.price_375ml
					};

					const custom = customFieldMap[v.variant_ml ?? 0];

					const pricePerML = pItem.price / (item.ml_per_unit ?? 1);
					const autoPrice = Math.round(pricePerML * (v.variant_ml ?? 1));

					const finalPrice = typeof custom === "number" ? custom : autoPrice;

					await tx.item.update({
						where: { id: v.id },
						data: { selling_price: finalPrice }
					});
				}
			}
		}

		// Update total amount of purchase
		await tx.purchase.update({
			where: { id: purchaseRecord.id },
			data: { total_amount: totalAmount }
		});

		return purchaseRecord;
	});

	return purchase;
}

export async function getAllPurchases() {
	return prisma.purchase.findMany({
		include: {
			vendor: true,
			user: true,
			items: {
				include: { item: true }
			}
		}
	});
}
