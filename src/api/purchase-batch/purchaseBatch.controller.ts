import { Request, Response } from "express";
import * as batchService from "./purchaseBatch.service";

export async function getBatchesByItemHandler(req: Request, res: Response) {
	try {
		const itemId = Number(req.params.itemId);
		const batches = await batchService.getBatchesByItem(itemId);
		res.json(batches);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getBatchByIdHandler(req: Request, res: Response) {
	try {
		const batchId = Number(req.params.batchId);
		const batch = await batchService.getBatchById(batchId);
		if (!batch) return res.status(404).json({ error: "Batch not found" });
		res.json(batch);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getAllBatchesHandler(req: Request, res: Response) {
	try {
		const list = await batchService.getAllBatches();
		res.json(list);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}
