import { Request, Response } from "express";
import * as userService from "./user.service";

export async function createUser(req: Request, res: Response) {
	try {
		const { name, email, password, roleid, username } = req.body;
		let role_id = parseInt(roleid);
		if (!name)
			return res.status(400).json({ error: "name is required" });


		const user = await userService.create({ name, email, password, role_id, username });
		res.status(201).json(user);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}

export async function getAllUsers(req: Request, res: Response) {
	try {
		const users = await userService.getAll();
		res.status(200).json(users);
	} catch (err: any) {
		res.status(500).json({ error: err.message });
	}
}

export async function deleteUser(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const result = await userService.remove(id);
		res.status(200).json(result);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}


export async function updateUser(req: Request, res: Response) {
	try {
		const id = parseInt(req.params.id);
		const { name, email, password, role_id, is_active } = req.body;
		const user = await userService.update(id, {
			name,
			email,
			password,
			role_id,
			is_active,
		});

		res.status(200).json(user);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}