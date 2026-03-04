import { Request, Response } from "express";
import * as service from "./customer.service";

export async function create(req: Request, res: Response) {
	try {
		res.status(201).json(await service.createCustomer(req.body));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function getAll(req: Request, res: Response) {
	try {
		res.json(await service.getAllCustomers());
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
}

export async function getById(req: Request, res: Response) {
	try {
		res.json(await service.getCustomerById(Number(req.params.id)));
	} catch (e: any) {
		res.status(404).json({ error: e.message });
	}
}

export async function update(req: Request, res: Response) {
	try {
		res.json(await service.updateCustomer(Number(req.params.id), req.body));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}

export async function remove(req: Request, res: Response) {
	try {
		res.json(await service.deleteCustomer(Number(req.params.id)));
	} catch (e: any) {
		res.status(400).json({ error: e.message });
	}
}
