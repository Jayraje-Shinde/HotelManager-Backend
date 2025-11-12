import prisma from '../../config/db';
import { CreateCategoryInput } from '../../types/category';

export async function create(data: CreateCategoryInput) {
	const categoryName = data.name.trim().toLowerCase();
	const existing = await prisma.category.findUnique({ where: { name: categoryName } });
	if (existing) throw new Error("Category Already Exists");

	if (!data.name?.trim()) throw new Error("Category name required");

	return prisma.category.create({
		data: {
			name: categoryName,
			is_liquor: data.is_liquor
		}
	});
}

export async function getAll() {
	return prisma.category.findMany();
}

export async function remove(id: number) {
	const category = await prisma.category.findUnique({ where: { id } });
	if (!category) throw new Error("Did not find Category");


	const linkedItems = await prisma.item.findMany({ where: { category_id: id } });
	if (linkedItems.length > 0) {
		throw new Error("Cannot delete: This Category is linked to existing items");
	}

	await prisma.category.delete({ where: { id } });
	return { message: "Category Deleted Successfully" }
}


export async function update(id: number, data: CreateCategoryInput) {
	const category = await prisma.category.findUnique({ where: { id } });

	if (!category) throw new Error("Category does not exist");

	const updated_name = data.name.trim().toLowerCase();

	const duplicate = await prisma.category.findUnique({ where: { name: updated_name } });

	if (duplicate && duplicate.id !== id) throw new Error("Category Name already exisits try new name for updating");

	return prisma.category.update({
		where: { id },
		data: {
			name: updated_name,
			is_liquor: data.is_liquor
		}
	})

}