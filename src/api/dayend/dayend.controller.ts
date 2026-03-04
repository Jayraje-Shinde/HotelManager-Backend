import { Request, Response } from "express";
import { closeDay, reopenDay, getDayEnd, getPrecheck } from "./dayend.service";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";

export async function closeDayController(req: Request, res: Response) {
	try {
		const { business_date, forceClose = false, note = "" } = req.body;
		const userId = req.user.id;
		const ip     = req.ip ?? null;

		const result = await closeDay({ business_date, userId, forceClose, note });
		await audit(userId, AuditEvent.DAY_CLOSE,
			`Day closed: ${business_date}${forceClose ? " (forced)" : ""}`, ip);

		res.status(200).json({ success: true, dayClosingId: result.id });
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function reopenDayController(req: Request, res: Response) {
	try {
		const { business_date, reason } = req.body;
		const adminId = req.user.id;
		const ip      = req.ip ?? null;

		const result = await reopenDay(business_date, adminId, reason);
		await audit(adminId, AuditEvent.DAY_REOPEN,
			`Day reopened: ${business_date} — reason: ${reason}`, ip);

		res.status(200).json({ success: true, result });
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getDayEndController(req: Request, res: Response) {
	try {
		res.status(200).json(await getDayEnd(req.params.date));
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function precheckDayend(req: Request, res: Response) {
	try {
		const business_date = String(req.query.business_date);
		res.status(200).json(await getPrecheck(business_date));
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
