// src/api/reports/kot/kot-report.controller.ts
import { Request, Response } from "express";
import * as service from "./kot-report.service";

export async function getKOTReport(req: Request, res: Response) {
	try {
		const { start, end, waiter_id, table_no } = req.query;

		const waiterIdNum =
			typeof waiter_id !== "undefined" ? parseInt(waiter_id as string) : undefined;

		const data = await service.kotReport(
			start ? (start as string) : undefined,
			end ? (end as string) : undefined,
			waiterIdNum,
			table_no ? (table_no as string) : undefined
		);

		res.json(data);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
}
