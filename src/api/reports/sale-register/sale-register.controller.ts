import { Request, Response } from "express";
import * as service from "./sale-register.service";

export async function getSalesRegister(req: Request, res: Response) {
	try {
		const { start, end, user_id } = req.query;

		const userIdNum = user_id ? parseInt(user_id as string) : undefined;

		const data = await service.salesRegister(
			start ? (start as string) : undefined,
			end ? (end as string) : undefined,
			userIdNum
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
