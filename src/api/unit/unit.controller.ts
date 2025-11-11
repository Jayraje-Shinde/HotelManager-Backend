import { Response, Request } from "express";
import * as unitService from './unit.service';

export async function createUnit(req: Request, res: Response) {
	try {
		const { name, description } = req.body;
		if (!name) return res.status(400).json({ error: "Name Required" });

		const unit = await unitService.createUnit({ name, description });
		res.status(201).json(unit);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
export async function getAllUnit(req: Request, res: Response) {
	try {
		const units = await unitService.getAll();
		res.status(200).json(units);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
export async function deleteUnit(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await unitService.remove(id);
		res.status(200).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}