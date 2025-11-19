import prisma from "../../config/db";
import { CreateUserInput } from "../../types/user";
import bcrypt from "bcryptjs";

export async function getAll() {
	return prisma.user.findMany({
		include: { role: true },
		orderBy: { id: "asc" },
	});
}

export async function remove(id: number) {
	const user = await prisma.user.findUnique({ where: { id } });
	if (!user) throw new Error("User not found");

	await prisma.user.delete({ where: { id } });
	return { message: "User deleted Successfully" };
}

export async function create(data: CreateUserInput) {
	// 1. Check duplicate email only if email exists
	if (data.email) {
		const existing = await prisma.user.findUnique({
			where: { email: data.email },
		});
		if (existing) throw new Error("User with this email already exists");
	}

	// 2. Hash password only when provided
	let hashedPassword: string | null = null;
	if (data.password && data.password.trim() !== "") {
		hashedPassword = await bcrypt.hash(data.password, 10);
	}

	// 3. Create user (email/password can be null)
	return prisma.user.create({
		data: {
			name: data.name,
			email: data.email ? data.email.toLowerCase() : null,
			password_hash: hashedPassword,
			role_id: data.role_id,
		},
		include: { role: true },
	});
}

export async function update(
	id: number,
	data: Partial<CreateUserInput & { is_active?: Boolean }>
) {
	const user = await prisma.user.findUnique({ where: { id } });
	if (!user) throw new Error("No user found");

	if (data.email) {
		const existing = await prisma.user.findUnique({ where: { email: data.email } });
		if (existing && existing.id !== id) {
			throw new Error("Email already exisits");
		}
	}

	let hashedPassword: string | null = user.password_hash;
	if (data.password && data.password.trim() !== "") {
		hashedPassword = await bcrypt.hash(data.password, 10);
	}

	return prisma.user.update({
		where: { id },
		data: {
			name: data.name ?? user.name,
			email: data.email ? data.email.toLowerCase() : user.email,
			password_hash: hashedPassword,
			role_id: data.role_id ?? user.role_id,
			is_active:
				typeof data.is_active === "boolean" ? data.is_active : user.is_active,
		},
		include: { role: true },
	});
}
