import { Request, Response } from "express";
import * as billingService from "./billing.service";
import prisma from "../../config/db";

export async function createBilling(req: Request, res: Response) {
	try {
		const payload = req.body;
		const bill = await billingService.createBillFromKOT(payload);
		return res.status(201).json(bill);
	} catch (err: any) {
		return res.status(400).json({ error: err.message ?? err.toString() });
	}
}

export async function payBill(req: Request, res: Response) {
	try {
		const billId = parseInt(req.params.id);
		const payments = req.body.payments;
		if (!Array.isArray(payments)) return res.status(400).json({ error: "payments_required_array" });

		const updated = await billingService.addPaymentToBill(billId, payments);
		return res.status(200).json(updated);
	} catch (err: any) {
		return res.status(400).json({ error: err.message ?? err.toString() });
	}
}

export async function getBillById(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const bill = await billingService.getBill(id);
		if (!bill) return res.status(404).json({ error: "bill_not_found" });
		return res.json(bill);
	} catch (err: any) {
		return res.status(400).json({ error: err.message ?? err.toString() });
	}
}

export async function deleteBill(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await billingService.rollbackBill(id);
		return res.json(result);
	} catch (err: any) {
		return res.status(400).json({ error: err.message });
	}
}

