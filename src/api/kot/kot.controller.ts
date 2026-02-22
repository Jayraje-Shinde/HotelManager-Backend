import { Request, Response } from "express";
import * as service from "./kot.service";

export async function create(req: Request, res: Response) {
  try {
    res.status(201).json(await service.createKOT(req.body));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function addItem(req: Request, res: Response) {
  try {
    res.status(201).json(
      await service.addItemToKOT(Number(req.params.id), req.body)
    );
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function deleteItem(req: Request, res: Response) {
  try {
    res.status(201).json(
      await service.deleteItemFromKOT(Number(req.params.id), req.body)
    );
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
    res.json(await service.serveKOT(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function close(req: Request, res: Response) {
  try {
    res.json(await service.closeKOT(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getKOTbyBillid(req: Request, res: Response) {
  try {
		const {bill_id} = req.query;
    res.json(await service.getKOTbyBillid(Number(bill_id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}