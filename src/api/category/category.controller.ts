import { Request, Response } from "express";
import * as categoryService from './category.service';
import prisma from "../../config/db";

export async function deleteCategory(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await categoryService.remove(id);
		res.status(200).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function createCategory(req: Request, res: Response) {
	try {
		const { name, is_liquor } = req.body;

		if (!name) return res.status(400).json({ error: "Name required" });

		const category = await categoryService.create({ name, is_liquor });
		res.status(201).json(category);

	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllCategory(req: Request, res: Response) {

	try {
		const category = await categoryService.getAll();
		res.status(200).json(category);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}

}

export async function updateCategory(req: Request, res: Response) {

	try {
		const id = parseInt(req.params.id);
		const { name, is_liquor } = req.body;

		const updated = await categoryService.update(id, { name, is_liquor });
		res.status(200).json(updated);

	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}