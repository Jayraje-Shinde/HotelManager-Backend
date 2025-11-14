import { Request, Response } from "express";
import * as stockMovementService from './stock_movement.service';
import prisma from "../../config/db";


export async function list(req: Request, res: Response) {

	try {

		const movements = await stockMovementService.getAll();
		res.json(movements);

	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}


export async function listbyItem(req: Request, res: Response) {

	try {

		const item_id = parseInt(req.params.id);
		const movements = await stockMovementService.getByItem(item_id);
		res.json(movements);

	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}


export async function record(req: Request, res: Response) {

	try {
		const { item_id, change_qty, ref_id, ref_type, reason, created_by } = req.body;
		if (!item_id || !change_qty || !reason) return res.status(400).json({ error: "item id,change_qty and reason are required" });

		const result = await stockMovementService.recordMovement({
			item_id: Number(item_id),
			change_qty: Number(change_qty),
			reason,
			ref_type,
			ref_id,
			created_by
		});

		res.status(201).json(result)

	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}