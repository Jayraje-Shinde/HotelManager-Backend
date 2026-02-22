import { resourceUsage } from "process";
import prisma from "../../config/db";
import {
	BottleSizeInput,
	CreateLiquorInput,
	CreateNonLiquorInput,
	UpdateItemInput
} from "./item.types";

/**
 * Create Liquor Items (multiple bottle sizes)
 */
export async function createLiquorItem(data: CreateLiquorInput) {
	const name = data.name.trim();

	if (!data.bottle_sizes || data.bottle_sizes.length === 0) {
		throw new Error("Bottle sizes required for liquor item");
	}

	// Create one item PER bottle size where price is provided
	const itemsToCreate = data.bottle_sizes.filter(b => b.price !== null);

	if (itemsToCreate.length === 0) {
		throw new Error("At least one bottle size must have price");
	}

	const createdItems = await prisma.$transaction(async (tx) => {
		const results: any = [];

		for (const bottle of itemsToCreate) {
			const itemName = `${name} ${bottle.ml}ml`;

			const item = await tx.item.create({
				data: {
					name: itemName,
					category_id: data.category_id,
					unit_id: data.unit_id,
					tax_rate: data.tax_rate,
					selling_price: bottle.price!,
					stock: 0,
					code : data.code,
					excise_rate : data.excise_rate,
					peg_price_per_ml : data.peg_price_per_ml,
					is_available: true,
					manage_stock: true,

					is_liquor: true,
					ml_per_unit: bottle.ml
				}
			});

			results.push(item);
		}

		return results;
	});

	return createdItems;
}

/**
 * Create Non-Liquor Item
 */
export async function createNonLiquorItem(data: CreateNonLiquorInput) {
	const name = data.name.trim();

	const item = await prisma.item.create({
		data: {
			name,
			category_id: data.category_id,
			unit_id: data.unit_id,
			code:data.code,
			tax_rate: data.tax_rate,
			selling_price: data.selling_price,
			stock: data.stock ?? 0,
			manage_stock: false,
			is_available: true,
			is_liquor: false
		}
	});

	return item;
}

/**
 * Get All Items
 */
export async function getAllItems() {
	return prisma.item.findMany({
		orderBy: { id: "asc" }
	});
}

/**
 * Get Single Item
 */
export async function getItemById(id: number) {
	return prisma.item.findUnique({
		where: { id }
	});
}

/**
 * Update Item
 */
export async function updateItem(id: number, data: UpdateItemInput) {
	const updateData: any = {};

	if (data.name !== undefined) updateData.name = data.name.trim();
	if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
	if (data.selling_price !== undefined) updateData.selling_price = data.selling_price;
	if (data.stock !== undefined) updateData.stock = data.stock;
	if (data.is_available !== undefined) updateData.is_available = data.is_available;
	if (data.manage_stock !== undefined) updateData.manage_stock = data.manage_stock;

	return prisma.item.update({
		where: { id },
		data: updateData
	});
}

/**
 * Delete item (only if no batches exist)
 */
export async function deleteItem(id: number) {
	const batchExists = await prisma.purchaseBatch.findFirst({
		where: { item_id: id }
	});

	if (batchExists) {
		throw new Error("Cannot delete item: linked purchase batches exist");
	}

	await prisma.item.delete({
		where: { id }
	});

	return { message: "Item deleted successfully" };
}

export async function getItemByCategory(id : number) {
	const result = await prisma.item.findMany({where : {
		category_id : id
	}}) ;

	return result;

}
