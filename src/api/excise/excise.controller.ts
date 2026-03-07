import { Request, Response } from "express";
import * as service from "./excise.service";

export async function flr1aReport(req: Request, res: Response) {
	try {
		const date = req.query.date as string ?? new Date().toISOString().slice(0, 10);
		res.json(await service.flr1a(date));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function flr3aReport(req: Request, res: Response) {
	try {
		const month = req.query.month as string
			?? new Date().toISOString().slice(0, 7);
		res.json(await service.flr3a(month));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function flr4Report(req: Request, res: Response) {
	try {
		const month = req.query.month as string
			?? new Date().toISOString().slice(0, 7);
		res.json(await service.flr4(month));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function consumption(req: Request, res: Response) {
	try {
		const date = req.query.date as string ?? new Date().toISOString().slice(0, 10);
		res.json(await service.consumptionReport(date));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function breakage(req: Request, res: Response) {
	try {
		const from = req.query.from as string | undefined;
		const to   = req.query.to   as string | undefined;
		res.json(await service.breakageRegister(from, to));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function gstSales(req: Request, res: Response) {
	try {
		const from = (req.query.from as string) ?? new Date().toISOString().slice(0, 10);
		const to   = (req.query.to   as string) ?? new Date().toISOString().slice(0, 10);
		res.json(await service.gstSeparatedReport(from, to));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function stockVariance(req: Request, res: Response) {
	try {
		const from      = (req.query.from as string) ?? new Date().toISOString().slice(0, 10);
		const to        = (req.query.to   as string) ?? new Date().toISOString().slice(0, 10);
		const threshold = req.query.threshold ? Number(req.query.threshold) : 50;
		res.json(await service.stockVarianceReport(from, to, threshold));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function purchaseRegisterExcise(req: Request, res: Response) {
	try {
		const from     = req.query.from      as string | undefined;
		const to       = req.query.to        as string | undefined;
		const vendorId = req.query.vendor_id ? Number(req.query.vendor_id) : undefined;
		res.json(await service.excisePurchaseRegister(from, to, vendorId));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function flr3Report(req: Request, res: Response) {
	try {
		const month = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);
		res.json(await service.flr3(month));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function beerAReport(req: Request, res: Response) {
	try {
		const month = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);
		res.json(await service.beerA(month));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function vatLiability(req: Request, res: Response) {
	try {
		const month = (req.query.month as string) ?? new Date().toISOString().slice(0, 7);
		res.json(await service.vatLiabilityReport(month));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
