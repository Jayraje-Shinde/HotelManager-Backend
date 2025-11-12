import prisma from "../../config/db";

import { CreateItemInput } from "../../types/item";

export async function remove(id: number) {
	const item = await prisma.item.findUnique({ where: { id } });
	if (!item) throw new Error("Item not found");

	await prisma.item.delete({ where: { id } });
	return { message: "Item deleted successfully" };
}

export async function getAll() {
	return prisma.item.findMany({
		include: { category: true, unit: true },
		orderBy: { id: "asc" },
	});
}

export async function create(data: CreateItemInput) {

	const itemName = data.name.trim().toLowerCase();

	//valid category check
	const category = await prisma.category.findUnique({ where: { id: data.category_id } });
	if (!category) throw new Error("Category Invalid or not found");

	//valid unit check
	const unit = await prisma.unit.findUnique({ where: { id: data.unit_id } });
	if (!unit) throw new Error("Invalid unit id");

	//finding same item in same category
	const existing = await prisma.item.findFirst({
		where: { name: itemName, category_id: data.category_id },
	});
	if (existing) throw new Error("Item already exists in this category");

	return prisma.item.create({
		data: {
			name: itemName,
			category_id: data.category_id,
			unit_id: data.unit_id,
			selling_price: data.selling_price,
			purchase_price: data.purchase_price,
			tax_rate: data.tax_rate ?? null,
			stock: data.stock ?? 0,
			is_available: data.is_available ?? true,
			duty_per_unit: data.duty_per_unit ?? null,
		},
		include: { category: true, unit: true },
	});
}


export async function update(id: number, data: Partial<CreateItemInput>) {
	const item = await prisma.item.findUnique({ where: { id } });
	if (!item) throw new Error("Item not found");

	// Validate category (if updating)
	if (data.category_id) {
		const category = await prisma.category.findUnique({ where: { id: data.category_id } });
		if (!category) throw new Error("Invalid category");
	}

	// Validate unit (if updating)
	if (data.unit_id) {
		const unit = await prisma.unit.findUnique({ where: { id: data.unit_id } });
		if (!unit) throw new Error("Invalid unit");
	}

	// Prevent duplicate name within same category
	if (data.name) {
		const existing = await prisma.item.findFirst({
			where: {
				name: data.name.trim().toLowerCase(),
				category_id: data.category_id ?? item.category_id,
				NOT: { id },
			},
		});
		if (existing) throw new Error("Item with this name already exists in category");
	}

	const updatedItem = await prisma.item.update({
		where: { id },
		data: {
			name: data.name ? data.name.trim().toLowerCase() : item.name,
			category_id: data.category_id ?? item.category_id,
			unit_id: data.unit_id ?? item.unit_id,
			selling_price: data.selling_price ?? item.selling_price,
			purchase_price: data.purchase_price ?? item.purchase_price,
			tax_rate: data.tax_rate ?? item.tax_rate,
			stock: data.stock ?? item.stock,
			is_available: data.is_available ?? item.is_available,
			duty_per_unit: data.duty_per_unit ?? item.duty_per_unit,
		},
		include: { category: true, unit: true },
	});

	return updatedItem;
}
