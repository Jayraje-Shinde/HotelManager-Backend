// src/modules/liquor/liquor.controller.ts

import { Request, Response } from "express";
import * as service from "./liquor.service";

export async function breakBottle(req: Request, res: Response) {
  try {
    const itemId = Number(req.params.itemId);
    const userId = (req as any).user?.id ?? 1;
    res.json(await service.breakBottle(itemId, userId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export async function getOpen(req: Request, res: Response) {
  try {
    const itemId = req.query.itemId
      ? Number(req.query.itemId)
      : undefined;

    res.json(await service.getOpenBottles(itemId));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}
