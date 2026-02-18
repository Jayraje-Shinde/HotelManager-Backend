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

export async function createBill(req: Request, res: Response) {
  try {
    const { table_no } = req.body;

    const bill = await service.createBill(table_no);

    return res.status(201).json(bill);

  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function getBillByID(req: Request, res: Response) {
  try {
    const billid  = Number(req.params.billid);

    const bill = await service.findBillByID(billid);

    return res.status(201).json(bill);

  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function assignWaiter(req: Request, res: Response) {
  try {
    const billID  = Number(req.body.billID);
	const waiterID = Number(req.body.waiterID);
    const bill = await service.assignWaiterTobill(billID,waiterID);

    return res.status(201).json(bill);

  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}