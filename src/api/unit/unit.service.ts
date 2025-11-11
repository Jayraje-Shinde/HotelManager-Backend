import prisma from "../../config/db";
import { unitType } from "../../types/unit";

export async function createUnit(data: unitType) {
	const unitName = data.name?.trim().toLowerCase();
	if (!unitName) throw new Error("Unit name is Required");

	const existing = await prisma.unit.findUnique({ where: { name: unitName } });
	if (existing) throw new Error("Unit already exists");

	return prisma.unit.create({
		data: {
			name: unitName,
			description: data.description?.trim() || null,
		},
	});
}

export async function getAll() {
	return prisma.unit.findMany();
}

export async function remove(id: number) {
	const unit = await prisma.unit.findUnique({ where: { id } });

	if (!unit) throw new Error("unit not found");


	const linkedItems = await prisma.item.findMany({ where: { unit_id: id } });
	if (linkedItems.length > 0) {
		throw new Error("Cannot delete: This unit is linked to existing items");
	}

	await prisma.unit.delete({ where: { id } });
	return { message: "unit Deleted Successfully" };
}