import { Request, Response } from "express";
import * as service from "./billing.service";

export async function closeBill(req: Request, res: Response) {
	try {
		res.json(await service.closeBill(Number(req.params.id)));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function pay(req: Request, res: Response) {
	try {
		res.json(
			await service.addPaymentToBill(Number(req.params.id), req.body.payments)
		);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
export async function getopenbills(req: Request, res: Response) {
	try {

		res.json (
			await service.getAllBills()
		)
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
