// src/api/kot/kot.controller.ts
import { Request, Response } from "express";
import * as kotService from "./kot.service";

export async function createKOTHandler(req: Request, res: Response) {
	try {
		const payload = req.body;
		const r = await kotService.createKOT(payload);
		res.status(201).json(r);
	} catch (err: any) {
		if (err.code === "PROMPT_BREAK_BOTTLE") return res.status(409).json({ error: "PROMPT_BREAK_BOTTLE", details: err });
		res.status(400).json({ error: err.message });
	}
}

export async function sendKOTHandler(req: Request, res: Response) {
	try {
		const kotId = parseInt(req.params.id);
		const r = await kotService.sendKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function serveKOTHandler(req: Request, res: Response) {
	try {
		const kotId = parseInt(req.params.id);
		const r = await kotService.serveKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function closeKOTHandler(req: Request, res: Response) {
	try {
		const kotId = parseInt(req.params.id);
		const r = await kotService.closeKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function cancelKOTHandler(req: Request, res: Response) {
	try {
		const kotId = parseInt(req.params.id);
		const r = await kotService.cancelKOT(kotId);
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllKOTsHandler(req: Request, res: Response) {
	try {
		const r = await kotService.getAll();
		res.json(r);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
