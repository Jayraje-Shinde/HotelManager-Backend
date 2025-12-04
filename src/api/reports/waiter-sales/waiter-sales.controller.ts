import { Request, Response } from "express";
import * as service from "./waiter-sales.service";

export async function getWaiterSales(req: Request, res: Response) {
	try {
		const { start, end, waiter_id } = req.query;

		const waiterIdNum = typeof waiter_id !== "undefined" ? parseInt(waiter_id as string) : undefined;

		const data = await service.waiterSales(
			start ? (start as string) : undefined,
			end ? (end as string) : undefined,
			waiterIdNum
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
