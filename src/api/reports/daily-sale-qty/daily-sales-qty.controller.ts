import { Request, Response } from "express";
import * as service from "./daily-sales-qty.service";

export async function getDailySalesQty(req: Request, res: Response) {
	try {
		const { start, end } = req.query;

		const data = await service.dailySalesQty(
			start ? String(start) : undefined,
			end ? String(end) : undefined
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
