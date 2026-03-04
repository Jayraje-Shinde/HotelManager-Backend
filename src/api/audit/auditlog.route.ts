import { Router, Request, Response } from "express";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";
import { getAuditLogs } from "../../utils/audit";

const router = Router();

/**
 * GET /api/auditlog
 * Query params:
 *   user_id  — filter by user
 *   action   — partial match (e.g. "KOT", "BILL")
 *   from     — date string yyyy-mm-dd
 *   to       — date string yyyy-mm-dd
 *   page     — page number (default 1)
 *   limit    — per page (default 50, max 200)
 */
router.get("/", auth, allowRoles("admin", "manager"), async (req: Request, res: Response) => {
	try {
		const result = await getAuditLogs({
			user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
			action:  req.query.action  as string | undefined,
			from:    req.query.from    as string | undefined,
			to:      req.query.to      as string | undefined,
			page:    req.query.page    ? Number(req.query.page)  : 1,
			limit:   req.query.limit   ? Number(req.query.limit) : 50
		});
		res.json(result);
	} catch (e: any) {
		res.status(500).json({ error: e.message });
	}
});

export default router;
