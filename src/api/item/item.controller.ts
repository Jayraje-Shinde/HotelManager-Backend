import { Request, Response } from "express";
import * as itemService from "./item.service";

export async function createLiquor(req: Request, res: Response) {
	try {
		const result = await itemService.createLiquorItem(req.body);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function createNonLiquor(req: Request, res: Response) {
	try {
		const result = await itemService.createNonLiquorItem(req.body);
		res.status(201).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getItems(req: Request, res: Response) {
	try {
		const items = await itemService.getAllItems();
		res.json(items);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function getItem(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		const item = await itemService.getItemById(id);

		if (!item) return res.status(404).json({ error: "Item not found" });

		res.json(item);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function updateItem(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		const updated = await itemService.updateItem(id, req.body);
		res.json(updated);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function deleteItem(req: Request, res: Response) {
	try {
		const id = Number(req.params.id);
		const result = await itemService.deleteItem(id);
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getItembyCategory(req: Request, res: Response) {
  try {
    const categoryId = Number(req.params.id);

    // Validate ID
    if (isNaN(categoryId)) {
      return res.status(400).json({
        error: "Invalid category ID"
      });
    }

    const result = await itemService.getItemByCategory(categoryId);

    res.json(result);

  } catch (err: any) {
    res.status(500).json({
      error: err.message
    });
  }
}
