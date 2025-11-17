import { Request, Response } from "express";
import * as purchaseService from "./purchase.service";

export async function createPurchaseHandler(req: Request, res: Response) {
	try {
		const payload = req.body;
		const created = await purchaseService.createPurchase(payload);
		res.status(201).json(created);
	} catch (err: any) {
		console.error("createPurchase error:", err);
		res.status(400).json({ error: err.message });
	}
}

export async function getAllPurchasesHandler(req: Request, res: Response) {
	try {
		const list = await purchaseService.getAllPurchases();
		res.json(list);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getPurchaseHandler(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		const p = await purchaseService.getPurchaseById(id);
		if (!p) return res.status(404).json({ error: "Purchase not found" });
		res.json(p);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}


export async function deletePurchase(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		//@ts-ignore
		const userId = req.user?.id ?? null; // optional

		const result = await purchaseService.deletePurchase(id, userId);
		res.json(result);

	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
