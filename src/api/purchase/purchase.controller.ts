import { Request, Response } from "express";
import * as purchaseService from "./purchase.service";

export async function createPurchase(req: Request, res: Response) {
	try {
		const { vendor_id, invoice_no, purchase_date, created_by, items } = req.body;

		if (!vendor_id || !invoice_no || !purchase_date || !items)
			return res.status(400).json({ error: "Missing required fields" });

		const purchase = await purchaseService.createPurchase({
			vendor_id,
			invoice_no,
			purchase_date,
			created_by,
			items
		});

		res.status(201).json(purchase);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllPurchases(req: Request, res: Response) {
	try {
		const purchases = await purchaseService.getAllPurchases();
		res.json(purchases);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}
