import prisma from "../../config/db";
import { CreateRoleInput } from '../../types/role';


export async function create(data: CreateRoleInput) {
	const roleName = data.role_name.trim().toLowerCase();
	const existing = await prisma.role.findUnique({
		where: { role_name: roleName },
	});

	if (existing) throw new Error("role already exists");

	return prisma.role.create({
		data: {
			role_name: roleName,
			description: data.description
		}
	});
}

export async function getAll() {
	return prisma.role.findMany();
}

export async function removeRole(id: number) {
	const role = await prisma.role.findUnique({ where: { id } });
	if (!role) {
		throw new Error("No such role in DB");
	}

	await prisma.role.delete({ where: { id } });

	return { message: "role deleted Successfully" };
}
