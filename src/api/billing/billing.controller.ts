import { Request, Response } from "express";
import * as billingService from "./billing.service";
import { CreateBillInput, CreateBillFromKOTInput, PaymentInput } from "./billing.types";

export async function createBillHandler(req: Request, res: Response) {
	try {
		const payload: CreateBillInput = req.body;
		const bill = await billingService.createBill(payload);
		return res.status(201).json(bill);
	} catch (err: any) {
		if (err && err.code === "PROMPT_BREAK_BOTTLE") {
			return res.status(409).json({ error: "PROMPT_BREAK_BOTTLE", details: err });
		}
		return res.status(400).json({ error: err?.message ?? String(err) });
	}
}

export async function createBillFromKOTHandler(req: Request, res: Response) {
	try {
		const payload: CreateBillFromKOTInput = req.body;
		const bill = await billingService.createBillFromKOT(payload);
		return res.status(201).json(bill);
	} catch (err: any) {
		if (err && err.code === "PROMPT_BREAK_BOTTLE") {
			return res.status(409).json({ error: "PROMPT_BREAK_BOTTLE", details: err });
		}
		return res.status(400).json({ error: err?.message ?? String(err) });
	}
}

export async function addPaymentToBillHandler(req: Request, res: Response) {
	try {
		const billId = parseInt(req.params.id, 10);
		const payments: PaymentInput[] = req.body.payments;
		const userId = (req as any).user?.id ?? undefined;
		const result = await billingService.addPaymentToBill(billId, payments, userId);
		return res.status(200).json({ ok: true, result });
	} catch (err: any) {
		return res.status(400).json({ error: err?.message ?? String(err) });
	}
}

export async function getBillHandler(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id, 10);
		const bill = await billingService.getBill(id);
		return res.status(200).json(bill);
	} catch (err: any) {
		return res.status(400).json({ error: err?.message ?? String(err) });
	}
}

export async function rollbackBillHandler(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id, 10);
		const userId = (req as any).user?.id ?? undefined;
		const result = await billingService.rollbackBill(id, userId);
		return res.status(200).json(result);
	} catch (err: any) {
		return res.status(400).json({ error: err?.message ?? String(err) });
	}
}
