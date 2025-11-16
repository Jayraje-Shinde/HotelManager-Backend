import { Request, Response } from "express";
import * as bottleService from "./bottle.service";

export async function breakBottleHandler(req: Request, res: Response) {
	try {
		const result = await bottleService.breakBottle(req.body);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getOpenBottlesHandler(req: Request, res: Response) {
	try {
		const bottles = await bottleService.getOpenBottles();
		res.json(bottles);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function closeBottleHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		const { breakage, reason } = req.body;

		const result = await bottleService.closeBottle(id, breakage, reason);
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
