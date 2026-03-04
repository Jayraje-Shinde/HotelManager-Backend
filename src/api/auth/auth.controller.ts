import { Request, Response } from "express";
import prisma from "../../config/db";
import bcrypt from "bcryptjs";
import { signToken } from "../../utils/jwt";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";

export async function login(req: Request, res: Response) {
	try {
		const { username, password } = req.body;
		const ip = req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null;

		const user = await prisma.user.findUnique({
			where: { username },
			include: { role: true, }
		});

		if (!user) {
			// Log failed attempt without user_id
			await audit(null, AuditEvent.USER_LOGIN, `Failed login attempt: username=${username}`, ip);
			return res.status(400).json({ error: "Invalid credentials" });
		}

		const valid = await bcrypt.compare(password, user.password_hash || "");
		if (!valid) {
			await audit(user.id, AuditEvent.USER_LOGIN, `Failed login: wrong password for ${username}`, ip);
			return res.status(400).json({ error: "Invalid credentials" });
		}

		const token = signToken({
			id:        user.id,
			role_id:   user.role_id,
			role_name: user.role?.name,
			username:  user.username,
			name:      user.name
		});

		res.cookie("auth_token", token, {
			httpOnly: true,
			secure:   false,
			sameSite: "lax",
			maxAge:   24 * 60 * 60 * 1000,
			path:     "/"
		});

		await audit(user.id, AuditEvent.USER_LOGIN, `Login: ${username} (${user.role?.name})`, ip);

		return res.json({
			token,
			res_user: { id: user.id, username: user.username, role: user.role?.name }
		});
	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function logout(req: Request, res: Response) {
	try {
		const ip = req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null;
		const userId = req.user?.id ?? null;

		res.clearCookie("auth_token", {
			httpOnly: true,
			sameSite: "lax",
			secure:   false,
			path:     "/"
		});

		await audit(userId, AuditEvent.USER_LOGOUT, `Logout`, ip);

		return res.status(200).json({ message: "Logged out" });
	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function me(req: Request, res: Response) {
	return res.status(200).json({ user: req.user });
}
