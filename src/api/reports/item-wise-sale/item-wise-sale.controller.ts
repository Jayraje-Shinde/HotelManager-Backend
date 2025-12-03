import { Request, Response } from "express";
import * as service from "./item-wise-sale.service";

export async function getItemWiseSales(req: Request, res: Response) {
	try {
		const { start, end, item_id, category_id, search } = req.query;

		const itemIdNum = item_id ? parseInt(item_id as string) : undefined;
		const categoryIdNum = category_id ? parseInt(category_id as string) : undefined;

		const data = await service.itemWiseSales(
			start ? (start as string) : undefined,
			end ? (end as string) : undefined,
			itemIdNum,
			categoryIdNum,
			search ? (search as string) : undefined
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
