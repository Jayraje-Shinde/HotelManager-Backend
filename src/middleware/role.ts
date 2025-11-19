import { Request, Response, NextFunction } from "express";

export function allowRoles(...roles: string[]) {
	return function (req: Request, res: Response, next: NextFunction) {
		const user = req.user;
		if (!user) return res.status(401).json({ error: "UNAUTHORISED" });

		if (!roles.includes(user.role_name)) {
			return res.status(401).json({ error: "FORBIDDEN" });
		}

		next();
	};
}