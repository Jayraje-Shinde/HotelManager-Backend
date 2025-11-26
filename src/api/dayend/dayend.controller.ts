import { Request, Response } from "express";
import { closeDay, reopenDay, getDayEnd } from "./dayend.service";

export async function closeDayController(req: Request, res: Response) {
	try {
		const { business_date, forceClose = false, note = "" } = req.body;
		const userId = req.user.id;

		const result = await closeDay({ business_date, userId, forceClose, note });

		res.status(200).json({ success: true, dayClosingId: result.id });
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function reopenDayController(req: Request, res: Response) {
	try {
		const { business_date, reason } = req.body;
		const adminId = req.user.id;

		const result = await reopenDay(business_date, adminId, reason);

		res.status(200).json({ success: true, result });
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getDayEndController(req: Request, res: Response) {
	try {
		const { date } = req.params;

		const result = await getDayEnd(date);

		res.status(200).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
