import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export function auth(req: Request, res: Response, next: NextFunction) {
	const token = req.cookies?.auth_token;

	if (!token) {
		return res.status(401).json({ error: "UNAUTHORIZED" });
	}

	try {
		const decoded = verifyToken(token);
		req.user = decoded;
		next();
	} catch {
		return res.status(401).json({ error: "TOKEN_INVALID_OR_EXPIRED" });
	}
}
