import { Request, Response } from "express";
import * as itemService from "./item.service";

export async function createItem(req: Request, res: Response) {
	try {
		const {
			name,
			category_id,
			unit_id,
			tax_rate,
			selling_price,
			purchase_price,
			stock,
			is_available,
			manage_stock,
			duty_per_unit,

			is_liquor,
			ml_per_unit,

			price_30ml,
			price_60ml,
			price_90ml,
			price_180ml,
			price_375ml
		} = req.body;

		if (!name || !category_id || !unit_id) {
			return res.status(400).json({ error: "name, category_id, unit_id are required" });
		}

		const item = await itemService.createItem({
			name,
			category_id,
			unit_id,
			tax_rate,
			selling_price,
			purchase_price,
			stock,
			is_available,
			manage_stock,
			duty_per_unit,

			is_liquor,
			ml_per_unit,

			price_30ml,
			price_60ml,
			price_90ml,
			price_180ml,
			price_375ml
		});

		res.status(201).json(item);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllItems(req: Request, res: Response) {
	try {
		const items = await itemService.getAllItems();
		res.json(items);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getItem(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const item = await itemService.getItem(id);
		res.json(item);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function deleteItem(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await itemService.deleteItem(id);
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
