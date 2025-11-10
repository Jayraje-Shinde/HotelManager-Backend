import { Request, Response } from "express";
import * as roleService from "./roles.service";

export async function createRole(req: Request, res: Response) {
	try {
		const { role_name, description } = req.body;

		if (!role_name) return res.status(400).json({ error: "Role name required" });

		const role = await roleService.create({ role_name, description });
		return res.status(201).json(role);

	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function getAllRoles(req: Request, res: Response) {
	try {

		const roles = await roleService.getAll();
		return res.status(200).json(roles);

	} catch (err: any) {
		return res.status(500).json({ error: err.message });
	}
}

export async function deleteRole(req: Request, res: Response) {
	try {

		const roleid = parseInt(req.params.id);
		const result = await roleService.removeRole(roleid);
		res.status(200).json(result);

	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}
