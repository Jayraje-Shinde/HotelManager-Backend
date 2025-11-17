import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";

export async function requireRole(allowed: string[]) {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const userId = req.headers["x-user-id"]; // frontend must send this
			if (!userId) return res.status(401).json({ error: "missing_user_id" });

			const user = await prisma.user.findUnique({
				where: { id: Number(userId) },
				include: { role: true }
			});

			if (!user) return res.status(401).json({ error: "invalid_user" });
			if (!user.role) return res.status(403).json({ error: "user_has_no_role" });

			if (!allowed.includes(user.role.role_name))
				return res.status(403).json({ error: "access_denied" });

			// Attach user for further use
			(req as any).user = user;
			next();
		} catch (err) {
			res.status(500).json({ error: "auth_error" });
		}
	};
}
