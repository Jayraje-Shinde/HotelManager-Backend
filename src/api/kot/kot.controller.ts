import { Request, Response } from "express";
import * as service from "./kot.service";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";

export async function create(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const kot    = await service.createKOT(req.body);
		await audit(userId, AuditEvent.KOT_CREATE, `KOT #${kot.id} created table=${req.body.table_no}`, ip);
		res.status(201).json(kot);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function addItem(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.addItemToKOT(Number(req.params.id), req.body);
		await audit(userId, AuditEvent.KOT_ITEM_ADD,
			`KOT #${req.params.id} item added: item_id=${req.body.item_id} qty=${req.body.quantity}`, ip);
		res.status(201).json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function deleteItem(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.deleteItemFromKOT(Number(req.params.id), req.body);
		await audit(userId, AuditEvent.KOT_ITEM_REMOVE,
			`KOT #${req.params.id} item removed: kot_item_id=${req.body.kot_item_id}`, ip);
		res.status(201).json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function updateQTYofItem(req: Request, res: Response) {
	try {
		res.status(201).json(
			await service.updateQtyOfIteminKOT(Number(req.params.id), req.body)
		);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function serve(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.serveKOT(Number(req.params.id));
		await audit(userId, AuditEvent.KOT_SERVE, `KOT #${req.params.id} marked SERVED`, ip);
		res.json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function close(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.closeKOT(Number(req.params.id));
		await audit(userId, AuditEvent.KOT_CLOSE, `KOT #${req.params.id} closed (stock deducted)`, ip);
		res.json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function getKOTbyBillid(req: Request, res: Response) {
	try {
		const { bill_id } = req.query;
		res.json(await service.getKOTbyBillid(Number(bill_id)));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
