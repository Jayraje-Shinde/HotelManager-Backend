import { Request, Response } from "express";

import * as reportService from './report.service';

export async function search(req: Request, res: Response) {
	try {
		const where: any = {};

		if (req.query.search) {
			where.name = {
				contains: req.query.search as string,
				mode: "insensitive"
			}
		}
		if (req.query.category) {
			where.category = {
				name: req.query.category
			}
		}

		if (req.query.is_liquor) {
			where.is_liquor = where.is_liquor === "1";
		}

		if (req.query.manage_stock) {
			where.manage_stock = req.query.manage_stock === "1";
		}

		if (req.query.stockbelow && req.query.stockabove) {
			where.stock = {
				lt: Number(req.query.stockbelow),
				gt: Number(req.query.stockabove)
			};
		} else if (req.query.stockbelow) {
			where.stock = {
				lt: Number(req.query.stockbelow)
			};
		} else if (req.query.stockabove) {
			where.stock = {
				gt: Number(req.query.stockabove)
			};
		}


		const result = await reportService.query(where);

		return res.status(200).json({
			result
		});
	} catch (err: any) {
		return res.status(400).json({ err })
	}



}