import { Request, Response } from "express";
import prisma from "../../config/db";
import bcrypt from "bcryptjs";
import { signToken } from "../../utils/jwt";

export async function login(req: Request, res: Response) {
	try {
		const { username, password } = req.body;

		const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });
		if (!user) return res.status(400).json({ error: "no user found" });

		const valid = await bcrypt.compare(password, user.password_hash || "");

		if (!valid) return res.status(400).json({ error: "INVALID PASSWORD" });

		const token = signToken({
			id: user.id,
			role_id: user.role_id,
			role_name: user.role?.role_name
		});

		return res.json({ token, user });
	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}