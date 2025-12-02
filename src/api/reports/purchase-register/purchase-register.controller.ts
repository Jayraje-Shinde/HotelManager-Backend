import { Request, Response } from "express";
import * as service from "./purchase-register.service";

export async function getPurchaseRegister(req: Request, res: Response) {
	try {
		const { start, end, vendor_id } = req.query;

		const vendorIdNum = vendor_id ? parseInt(vendor_id as string) : undefined;

		const data = await service.purchaseRegister(
			start ? (start as string) : undefined,
			end ? (end as string) : undefined,
			vendorIdNum
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
