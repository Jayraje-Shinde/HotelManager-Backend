import { Request, Response, NextFunction } from "express";
import prisma from "../config/db";

/**
 * Middleware factory to block write operations for a business_date that is already closed.
 *
 * Usage examples:
 * - router.post("/bill", auth, allowRoles("cashier"), blockIfDayClosed(), createBill)
 * - router.put("/bill/:id", auth, allowRoles("cashier"), blockIfDayClosed({ lookup: { model: "bill", idParam: "id", dateField: "bill_date" } }), updateBill)
 * - router.post("/purchase", auth, allowRoles("admin"), blockIfDayClosed({ field: "purchase_date", source: "body" }), createPurchase)
 *
 * Options:
 *  - field: string (field name that holds the date or datetime; default "business_date" or "bill_date")
 *  - source: "body" | "params" | "query" (where to read the date from). Default: "body"
 *  - lookup: { model: "bill" | "purchase" | "kot" | "openLiquorBottle", idParam?: string, dateField?: string }
 *      When provided, middleware will fetch the record by idParam (from req.params) and read its dateField.
 *
 * Behavior:
 *  - If it finds a business_date for the request and a DayClosing exists with status === "CLOSED",
 *    it returns 409 Conflict and prevents the write.
 *  - If no date is resolved, it allows the request to proceed (to avoid false blocking).
 */

function normalizeDateStringToMidnight(dateStr: string) {
	const d = new Date(dateStr);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function blockIfDayClosed(options?: {
	field?: string;
	source?: "body" | "params" | "query";
	lookup?: { model: string; idParam?: string; dateField?: string };
}) {
	const { field = "business_date", source = "body", lookup } = options || {};

	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1) If lookup option provided, fetch the record (useful for edits where id is passed)
			if (lookup && lookup.model && req.params) {
				const idParam = lookup.idParam || "id";
				const idValue = req.params[idParam];
				if (idValue) {
					let record: any = null;

					// Simple mapped lookup — extend if you add other models
					if (lookup.model === "bill") {
						record = await prisma.bill.findUnique({ where: { id: Number(idValue) } });
					} else if (lookup.model === "purchase") {
						record = await prisma.purchase.findUnique({ where: { id: Number(idValue) } });
					} else if (lookup.model === "kot") {
						record = await prisma.kOT.findUnique({ where: { id: Number(idValue) } });
					} else if (lookup.model === "openLiquorBottle") {
						record = await prisma.openLiquorBottle.findUnique({ where: { id: Number(idValue) } });
					} else {
						// generic attempt: try to query by id on given model name using $queryRaw fallback
						try {
							// WARNING: minimal generic fallback, but kept safe by requiring presence of id
							const table = lookup.model;
							const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE id = ${Number(idValue)} LIMIT 1`);
							if (Array.isArray(rows) && rows.length) record = rows[0];
						} catch (e) {
							// ignore fallback errors
						}
					}

					const dateField = lookup.dateField || "bill_date" || "purchase_date";
					if (record && record[dateField]) {
						const normalized = normalizeDateStringToMidnight(String(record[dateField]));
						const closed = await prisma.dayClosing.findUnique({ where: { business_date: normalized } });
						if (closed && closed.status === "CLOSED") {
							return res.status(409).json({ error: `Operation not allowed: Day is closed for ${normalized.toISOString().slice(0, 10)}` });
						}
						return next();
					}
				}
			}

			// 2) Read date from given source
			let dateCandidate: string | undefined;

			if (source === "body" && req.body) {
				dateCandidate = req.body[field] ?? req.body["bill_date"] ?? req.body["created_at"];
			} else if (source === "params" && req.params) {
				dateCandidate = req.params[field] ?? req.params["date"] ?? req.params["bill_date"];
			} else if (source === "query" && req.query) {
				dateCandidate = (req.query[field] as string) ?? (req.query["date"] as string) ?? (req.query["bill_date"] as string);
			}

			// If client passed an ISO datetime (e.g., "2025-01-20T10:00:00"), extract date part
			if (dateCandidate && typeof dateCandidate === "string") {
				// Accept "YYYY-MM-DD" or full ISO. Create Date object and normalize to midnight.
				const normalized = normalizeDateStringToMidnight(dateCandidate);
				const closed = await prisma.dayClosing.findUnique({ where: { business_date: normalized } });
				if (closed && closed.status === "CLOSED") {
					return res.status(409).json({ error: `Operation not allowed: Day is closed for ${normalized.toISOString().slice(0, 10)}` });
				}
				return next();
			}

			// 3) No date resolved — allow request (avoid blocking non-date writes).
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const closedToday = await prisma.dayClosing.findUnique({
				where: { business_date: today }
			});

			if (closedToday && closedToday.status === "CLOSED") {
				return res.status(409).json({
					error: `Operation not allowed: Day is closed for ${today.toISOString().slice(0, 10)}`
				});
			}

			return next();
		} catch (err: any) {
			// If middleware fails unexpectedly, fail safe by blocking the write and logging error
			console.error("blockIfDayClosed error:", err);
			return res.status(500).json({ error: "Internal error validating day-close status" });
		}
	};
}
