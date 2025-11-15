import prisma from "../../config/db";
import { createLiquorVariants } from "../../util/liquorVariant";

interface CreateItemInput {
	name: string;
	category_id: number;
	unit_id: number;
	tax_rate?: number;
	selling_price?: number;
	purchase_price?: number;
	stock?: number | null;
	is_available?: boolean;
	manage_stock?: boolean;
	duty_per_unit?: number | null;

	// liquor
	is_liquor?: boolean;
	ml_per_unit?: number | null;

	// custom variant prices (null = auto generate)
	price_30ml?: number | null;
	price_60ml?: number | null;
	price_90ml?: number | null;
	price_180ml?: number | null;
	price_375ml?: number | null;
}

export async function createItem(data: CreateItemInput) {
	// validate name
	const name = data.name.trim();

	// create parent item (dish, raw item, liquor bottle, etc.)
	const item = await prisma.item.create({
		data: {
			name,
			category_id: data.category_id,
			unit_id: data.unit_id,

			tax_rate: data.tax_rate ?? 0,
			selling_price: data.selling_price ?? 0,
			purchase_price: data.purchase_price ?? 0,

			stock: data.manage_stock === false ? null : (data.stock ?? 0),

			is_available: data.is_available ?? true,
			manage_stock: data.manage_stock ?? true,

			duty_per_unit: data.duty_per_unit ?? null,

			is_liquor: data.is_liquor ?? false,
			ml_per_unit: data.is_liquor ? data.ml_per_unit ?? null : null,
			variant_ml: null,
			parent_id: null,

			// custom variant prices stored only in parent
			price_30ml: data.price_30ml ?? null,
			price_60ml: data.price_60ml ?? null,
			price_90ml: data.price_90ml ?? null,
			price_180ml: data.price_180ml ?? null,
			price_375ml: data.price_375ml ?? null
		}
	});

	// -------------------------------------------------------
	// LIQUOR LOGIC: Generate shot/variant items automatically
	// -------------------------------------------------------
	if (data.is_liquor) {
		if (!data.ml_per_unit) {
			throw new Error("Liquor item must have ml_per_unit (bottle size)");
		}

		await createLiquorVariants({
			id: item.id,
			name: item.name,
			category_id: item.category_id,
			unit_id: item.unit_id,
			purchase_price: item.purchase_price,
			ml_per_unit: data.ml_per_unit,

			price_30ml: data.price_30ml ?? null,
			price_60ml: data.price_60ml ?? null,
			price_90ml: data.price_90ml ?? null,
			price_180ml: data.price_180ml ?? null,
			price_375ml: data.price_375ml ?? null
		});
	}

	return item;
}

export async function getAllItems() {
	return prisma.item.findMany({
		orderBy: { id: "asc" },
		include: {
			variants: true,
			parent: true,
			category: true,
			unit: true
		}
	});
}

export async function getItem(id: number) {
	return prisma.item.findUnique({
		where: { id },
		include: {
			variants: true,
			parent: true,
			category: true,
			unit: true
		}
	});
}

export async function deleteItem(id: number) {
	const item = await prisma.item.findUnique({
		where: { id },
		include: { variants: true }
	});

	if (!item) throw new Error("Item not found");

	// prevent deleting liquor parent while variants exist
	if (item.variants.length > 0) {
		throw new Error("Cannot delete this liquor bottle item because variants exist");
	}

	await prisma.item.delete({ where: { id } });

	return { message: "Item deleted successfully" };
}
