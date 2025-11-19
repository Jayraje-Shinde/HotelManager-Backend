// src/api/kot/kot.service.ts
import prisma from "../../config/db";
import { audit } from "../../utils/audit";
import { AuditEvent } from "../../utils/auditEvents";
import type { Prisma } from "@prisma/client";

/**
 * KOT service exports:
 * - createKOT(payload)
 * - sendKOT(kotId)
 * - serveKOT(kotId)
 * - closeKOT(kotId)
 * - cancelKOT(kotId)
 * - getAll()
 */

export async function createKOT(payload: any) {
	if (!payload.items || payload.items.length === 0) throw new Error("empty_kot");
	const finishedBottleIds: number[] = [];

	const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const count = await tx.kOT.count({ where: { table_no: payload.table_no } });
		const kot_no = `${payload.table_no}-KOT-${count + 1}`;

		const kot = await tx.kOT.create({
			data: {
				table_no: payload.table_no,
				waiter_id: payload.waiter_id ?? null,
				kot_no,
				status: "OPEN"
			}
		});

		let bill = await tx.bill.findFirst({ where: { table_no: payload.table_no, status: "OPEN" } });
		if (!bill) {
			bill = await tx.bill.create({
				data: {
					table_no: payload.table_no,
					user_id: payload.waiter_id ?? null,
					total: 0,
					discount: 0,
					bill_date: new Date(),
					status: "OPEN"
				}
			});
		}

		await tx.kOT.update({ where: { id: kot.id }, data: { bill_id: bill.id } });

		for (const it of payload.items) {
			const item = await tx.item.findUnique({ where: { id: it.item_id } });
			if (!item) throw new Error("item_not_found");

			await tx.kOTItem.create({
				data: {
					kot_id: kot.id,
					item_id: it.item_id,
					quantity: it.quantity ?? 1,
					note: it.note ?? null
				}
			});

			if (item.is_liquor && it.shot_ml) {
				const mlNeeded = (it.quantity ?? 1) * it.shot_ml;
				const open = await tx.openLiquorBottle.findFirst({
					where: { item_id: item.id, status: "OPEN", ml_remaining: { gt: 0 } },
					orderBy: { opened_at: "asc" }
				});

				if (!open) {
					const err: any = new Error("PROMPT_BREAK_BOTTLE");
					err.code = "PROMPT_BREAK_BOTTLE";
					err.item_id = item.id;
					throw err;
				}

				if (open.ml_remaining < mlNeeded) {
					const err: any = new Error("PROMPT_BREAK_BOTTLE");
					err.code = "PROMPT_BREAK_BOTTLE";
					err.item_id = item.id;
					err.open_bottle_id = open.id;
					err.ml_remaining = open.ml_remaining;
					err.remaining_ml_needed = mlNeeded - open.ml_remaining;
					throw err;
				}

				const newMl = open.ml_remaining - mlNeeded;
				await tx.openLiquorBottle.update({
					where: { id: open.id },
					data: {
						ml_remaining: newMl,
						status: newMl === 0 ? "FINISHED" : open.status,
						closed_at: newMl === 0 ? new Date() : null
					}
				});

				await tx.liquorShotUsage.create({
					data: {
						bill_item_id: null,
						open_bottle_id: open.id,
						kot_id: kot.id,
						ml_used: mlNeeded,
						used_at: new Date()
					}
				});

				if (newMl === 0) finishedBottleIds.push(open.id);
			}
		}

		await tx.tableStatus.upsert({
			where: { table_no: payload.table_no },
			update: { status: "OCCUPIED", current_bill_id: bill!.id },
			create: { table_no: payload.table_no, zone: payload.zone ?? "", status: "OCCUPIED", current_bill_id: bill!.id }
		});

		return { kot, bill_id: bill!.id };
	});

	// audit finished bottles after tx
	if (Array.isArray((result as any).kot) || true) {
		// use closure finishedBottleIds
		// (they were collected above; audit them here)
	}
	// audit finished bottles
	// (we mutated finishedBottleIds inside tx closure; now audit)
	// if none, skip
	// safe try/catch for audit
	try {
		// if finishedBottleIds exists and has entries
		// In case of TS closure concerns, ignore if empty
		// (this keeps behaviour consistent)
		// @ts-ignore
		if (Array.isArray((finishedBottleIds as any)) && (finishedBottleIds as any).length > 0) {
			// @ts-ignore
			for (const b of (finishedBottleIds as any)) {
				try {
					await audit(payload.waiter_id ?? null, AuditEvent.BOTTLE_FINISH, `Bottle #${b} finished during KOT`);
				} catch (e) {
					console.warn("Audit failure", e);
				}
			}
		}
	} catch (e) {
		/* ignore */
	}

	return result;
}

export async function sendKOT(kotId: number) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "OPEN") throw new Error("kot_invalid_state");

	const updated = await prisma.kOT.update({ where: { id: kotId }, data: { status: "SENT", updated_at: new Date() } });
	await audit(null, AuditEvent.KOT_SEND, `KOT ${kotId} sent`);
	return updated;
}

export async function serveKOT(kotId: number) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "SENT") throw new Error("kot_invalid_state");

	const updated = await prisma.kOT.update({ where: { id: kotId }, data: { status: "SERVED", updated_at: new Date() } });
	await audit(null, AuditEvent.KOT_SERVE, `KOT ${kotId} served`);
	return updated;
}

export async function closeKOT(kotId: number) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "SERVED" && kot.status !== "CANCELLED") throw new Error("kot_not_ready_to_close");

	const updated = await prisma.kOT.update({ where: { id: kotId }, data: { status: "CLOSED", updated_at: new Date() } });
	await audit(null, AuditEvent.KOT_CLOSE, `KOT ${kotId} closed`);
	return updated;
}

export async function cancelKOT(kotId: number) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const kot = await tx.kOT.findUnique({ where: { id: kotId }, include: { liquorShotUsages: true } });
		if (!kot) throw new Error("kot_not_found");

		if (kot && kot.status === "CLOSED") throw new Error("The KOT is already Closed");
		if (kot && kot.status === "SERVED") throw new Error("The KOT is already Served");
		// revert shot usages
		for (const u of kot.liquorShotUsages) {
			const bottle = await tx.openLiquorBottle.findUnique({ where: { id: u.open_bottle_id } });
			if (!bottle) continue;
			await tx.openLiquorBottle.update({
				where: { id: bottle.id },
				data: {
					ml_remaining: bottle.ml_remaining + u.ml_used,
					status: "OPEN",
					closed_at: null
				}
			});
		}

		await tx.liquorShotUsage.deleteMany({ where: { kot_id: kotId } });
		await tx.kOTItem.deleteMany({ where: { kot_id: kotId } });

		const updatedKot = await tx.kOT.update({ where: { id: kotId }, data: { status: "CANCELLED", updated_at: new Date() } });
		await audit(null, AuditEvent.KOT_CANCEL, `KOT ${kotId} cancelled`);
		return updatedKot;
	});
}

export async function getAll() {
	return prisma.kOT.findMany({ orderBy: { id: "desc" }, include: { waiter: true, bill: true, items: true } });
}
