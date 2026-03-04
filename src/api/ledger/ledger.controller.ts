import { Request, Response } from "express";
import * as service from "./ledger.service";

export async function vendorLedger(req: Request, res: Response) {
	try {
		const id   = Number(req.params.id);
		const from = req.query.from as string | undefined;
		const to   = req.query.to   as string | undefined;
		res.json(await service.getVendorLedger(id, from, to));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function customerLedger(req: Request, res: Response) {
	try {
		const id   = Number(req.params.id);
		const from = req.query.from as string | undefined;
		const to   = req.query.to   as string | undefined;
		res.json(await service.getCustomerLedger(id, from, to));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function outstandingReport(req: Request, res: Response) {
	try {
		res.json(await service.getOutstandingReport());
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
}

export async function agingReport(req: Request, res: Response) {
	try {
		res.json(await service.getAgingReport());
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
}

export async function vendorsSummary(req: Request, res: Response) {
	try {
		res.json(await service.getAllVendorsSummary());
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
}
