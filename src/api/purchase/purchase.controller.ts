import { Request, Response } from "express";
import * as purchaseService from "./purchase.service";

export async function createPurchaseHandler(req: Request, res: Response) {
	try {
		const created = await purchaseService.createPurchase(req.body);
		res.status(201).json(created);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllPurchasesHandler(req: Request, res: Response) {
	try {
		res.json(await purchaseService.getAllPurchases());
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getPurchaseHandler(req: Request, res: Response) {
	try {
		const p = await purchaseService.getPurchaseById(Number(req.params.id));
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
		const userId = req.user?.id ?? null;
		res.json(await purchaseService.deletePurchase(id, userId));
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function addPaymentHandler(req: Request, res: Response) {
	try {
		const purchaseId = Number(req.params.id);
		//@ts-ignore
		const created_by = req.user?.id ?? null;
		const { amount, method, note } = req.body;

		const result = await purchaseService.addPurchasePayment(purchaseId, {
			amount,
			method,
			note,
			created_by
		});

		res.status(201).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
