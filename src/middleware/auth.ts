import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";


export function auth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;

	if (!header) return res.status(401).json({ error: "NO_TOKEN" });


	let token;
	if (header && header.startsWith("Bearer ")) {
		token = header.split(" ")[1];
	} else if (header) {
		token = header;
	} else {
		return res.status(401).json({ error: "INVALID_TOKEN" });
	}
	try {

		const decoded: any = verifyToken(token);
		req.user = decoded;
		next();

	} catch {
		return res.status(401).json({ error: "TOKEN_INVALID_OR_EXPIRED" });
	}
}