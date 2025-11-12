import { Request, Response } from "express";
import * as itemService from './item.service';


export async function createItem(req: Request, res: Response) {
	try {
		const item = await itemService.create(req.body);
		res.status(201).json(item);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}


export async function UpdateItem(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const updated = await itemService.update(id, req.body);
		res.status(200).json(updated);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}


export async function deleteItem(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await itemService.remove(id);


		res.status(200).json(result);

	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}


export async function GetAllItems(req: Request, res: Response) {
	try {
		const items = await itemService.getAll();
		res.status(200).json(items);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}