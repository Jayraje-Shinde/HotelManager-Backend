import { Request, Response } from "express";
import * as kotService from "./kot.service";

export async function createKOTHandler(req: Request, res: Response) {
	try {
		const payload = req.body;
		const r = await kotService.createKOT(payload);
		res.status(201).json(r);
	} catch (err: any) {
		if (err.message === "PROMPT_BREAK_BOTTLE") {
			return res.status(409).json({
				error: "PROMPT_BREAK_BOTTLE",
				item_id: err.item_id,
				open_bottle_id: err.open_bottle_id ?? null,
				ml_remaining: err.ml_remaining ?? null,
				remaining_ml_needed: err.remaining_ml_needed ?? null
			});
		}
		res.status(400).json({ error: err.message });
	}
}

export async function sendKOTHandler(req: Request, res: Response) {
	try {
		const kotId = Number(req.params.id);
		const r = await kotService.sendKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function serveKOTHandler(req: Request, res: Response) {
	try {
		const kotId = Number(req.params.id);
		const r = await kotService.serveKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function cancelKOTHandler(req: Request, res: Response) {
	try {
		const kotId = Number(req.params.id);
		const { reason } = req.body;
		const r = await kotService.cancelKOT(kotId, reason);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function closeKOTHandler(req: Request, res: Response) {
	try {
		const kotId = Number(req.params.id);
		const r = await kotService.closeKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllKot(req: Request, res: Response) {
	try {
		const result = await kotService.getAll();
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
