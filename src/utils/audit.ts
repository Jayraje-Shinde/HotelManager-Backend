import prisma from "../config/db";
import { AuditEventType } from "./auditEvents";

// -------------------------------------------------------
// Core audit writer — never throws, always fire-and-forget
// -------------------------------------------------------
export async function audit(
	user_id:     number | null,
	action:      AuditEventType | string,
	description: string = "",
	ip:          string | null = null
) {
	try {
		await prisma.auditlog.create({
			data: { user_id, action, description, ip }
		});
	} catch (err) {
		// Audit failure must NEVER break the main flow
		console.warn("[AUDIT FAILED]", { action, user_id, err });
	}
}

// -------------------------------------------------------
// GET audit logs — filterable, paginated
// -------------------------------------------------------
export async function getAuditLogs(opts: {
	user_id?:  number;
	action?:   string;
	from?:     string;
	to?:       string;
	page?:     number;
	limit?:    number;
}) {
	const page  = Math.max(1, opts.page  ?? 1);
	const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
	const skip  = (page - 1) * limit;

	const where: any = {};

	if (opts.user_id) where.user_id = opts.user_id;
	if (opts.action)  where.action  = { contains: opts.action, mode: "insensitive" };

	if (opts.from || opts.to) {
		where.created_at = {};
		if (opts.from) where.created_at.gte = new Date(opts.from);
		if (opts.to) {
			const to = new Date(opts.to);
			to.setHours(23, 59, 59, 999);
			where.created_at.lte = to;
		}
	}

	const [total, logs] = await Promise.all([
		prisma.auditlog.count({ where }),
		prisma.auditlog.findMany({
			where,
			include: {
				user: { select: { id: true, name: true, username: true } }
			},
			orderBy: { created_at: "desc" },
			skip,
			take: limit
		})
	]);

	return {
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
		logs
	};
}
