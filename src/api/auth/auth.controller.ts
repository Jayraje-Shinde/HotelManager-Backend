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
			role_name: user.role?.role_name,
			username : user.username,
			name:user.name
		});
		const res_user = {
			id : user.id,
			username : user.username,
			role : user.role?.role_name
		};
			
		res.cookie("auth_token", token, {
	httpOnly: true,
	secure: false,          // MUST be false on http
	sameSite: "lax",        // IMPORTANT
	maxAge: 24 * 60 * 60 * 1000,
	path: "/"
});
		return res.json({ token, res_user });
	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function logout(req: Request, res: Response) {
	try {
		res.clearCookie("auth_token", {
			httpOnly: true,
			sameSite: "lax", // MUST match login
			secure: process.env.NODE_ENV === "production",
			path: "/"        // MUST match login
		});

		return res.status(200).json({ message: "Logged out" });
	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function me(req:Request, res:Response){
		return res.status(200).json({
		user: req.user
	});
}