import { Request, Response } from "express";
import * as paymentService from "./payment.service";

export async function addPaymentHandler(req: Request, res: Response) {
	try {
		const billId = Number(req.params.billId);
		const result = await paymentService.addPayment(billId, req.body);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
