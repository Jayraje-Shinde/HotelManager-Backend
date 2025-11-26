import { Request, Response } from "express";
import * as service from "./vendor.service";

export async function create(req: Request, res: Response) {
	try {
		const { name, contact, license_no, type } = req.body;

		if (!name) return res.status(400).json({ error: "Vendor name required" });

		if (type == "liquor" && !license_no) return res.status(400).json({ error: "Liquor vendor needs a licence" });

		const vendor = await service.createVendor({
			name,
			contact,
			license_no,
			type
		});

		res.status(201).json(vendor);

	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAll(req: Request, res: Response) {
	try {
		const vendors = await service.getAllVendors();
		res.json(vendors);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function remove(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await service.deleteVendor(id);
		res.json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
