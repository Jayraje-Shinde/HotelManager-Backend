import { Request, Response } from "express";
import * as service from "./billing.service";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";

export async function createBill(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const bill   = await service.createBill(req.body.table_no);
		await audit(userId, AuditEvent.BILL_CREATE, `Bill #${bill.id} created for table ${bill.table_no}`, ip);
		return res.status(201).json(bill);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function closeBill(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.closeBill(Number(req.params.id));
		await audit(userId, AuditEvent.BILL_CLOSE, `Bill #${req.params.id} closed`, ip);
		res.json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function pay(req: Request, res: Response) {
	try {
		const ip     = req.ip ?? null;
		const userId = req.user?.id ?? null;
		const result = await service.addPaymentToBill(Number(req.params.id), req.body.payments);
		const total  = (req.body.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
		await audit(userId, AuditEvent.BILL_PAY, `Bill #${req.params.id} payment ₹${total}`, ip);
		res.json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function markCredit(req: Request, res: Response) {
	try {
		const ip         = req.ip ?? null;
		const userId     = req.user?.id ?? null;
		const billId     = Number(req.params.id);
		const customerId = Number(req.body.customer_id);
		const result     = await service.markBillAsCredit(billId, customerId);
		await audit(userId, AuditEvent.BILL_CREDIT, `Bill #${billId} marked credit → customer #${customerId}`, ip);
		res.json(result);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function assignCustomer(req: Request, res: Response) {
	try {
		const billId     = Number(req.body.billID);
		const customerId = Number(req.body.customerID);
		res.json(await service.assignCustomerToBill(billId, customerId));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function getopenbills(req: Request, res: Response) {
	try {
		res.json(await service.getAllBills());
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function getBillByID(req: Request, res: Response) {
	try {
		const bill = await service.findBillByID(Number(req.params.billid));
		if (!bill) return res.status(404).json({ error: "Bill not found" });
		return res.json(bill);
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function assignWaiter(req: Request, res: Response) {
	try {
		res.json(await service.assignWaiterTobill(Number(req.body.billID), Number(req.body.waiterID)));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
