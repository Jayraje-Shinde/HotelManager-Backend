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

	// Helper: break a new bottle (uses FIFO PurchaseBatch.qty_remaining > 0)
	async function breakBottle(tx: Prisma.TransactionClient, itemId: number) {
		// find item for ml_per_unit
		const item = await tx.item.findUnique({ where: { id: itemId } });
		if (!item) throw new Error("item_not_found");

		// find oldest purchase batch with qty_remaining > 0 (FIFO)
		const batch = await tx.purchaseBatch.findFirst({
			where: { item_id: itemId, qty_remaining: { gt: 0 } },
			orderBy: { created_at: "asc" }
		});

		if (!batch) {
			const err: any = new Error("OUT_OF_STOCK");
			err.code = "OUT_OF_STOCK";
			err.item_id = itemId;
			throw err;
		}

		// decrement batch qty_remaining by 1
		await tx.purchaseBatch.update({
			where: { id: batch.id },
			data: { qty_remaining: { decrement: 1 } }
		});

		// create stock movement for breaking bottle (record we consumed 1 sealed bottle into open bottle)
		await tx.stockMovement.create({
			data: {
				item_id: itemId,
				change_qty: -1,
				reason: `Break bottle (auto) during KOT`,
				movement_type: "OPEN_BOTTLE",
				ref_id: null,
				created_by: payload.waiter_id ?? null
			}
		});

		// create the open bottle with ml_per_unit initial ml
		const mlPerUnit = item.ml_per_unit ?? 0;
		const ob = await tx.openLiquorBottle.create({
			data: {
				item_id: itemId,
				ml_remaining: mlPerUnit,
				opened_at: new Date(),
				status: "OPEN",
				breakage: false,
				batch_id: batch.id
			}
		});

		return ob;
	}

	// Helper: deduct ml from open bottle and record LiquorShotUsage; returns whether bottle finished (true/false)
	async function deductFromBottle(tx: Prisma.TransactionClient, bottleId: number, mlToUse: number, kotId: number) {
		const bottle = await tx.openLiquorBottle.findUnique({ where: { id: bottleId } });
		if (!bottle) throw new Error("open_bottle_not_found");

		const use = Math.min(bottle.ml_remaining, mlToUse);
		const newMl = bottle.ml_remaining - use;

		await tx.openLiquorBottle.update({
			where: { id: bottleId },
			data: {
				ml_remaining: newMl,
				status: newMl === 0 ? "FINISHED" : bottle.status,
				closed_at: newMl === 0 ? new Date() : null
			}
		});

		await tx.liquorShotUsage.create({
			data: {
				bill_item_id: null,
				open_bottle_id: bottleId,
				kot_id: kotId,
				ml_used: use,
				used_at: new Date()
			}
		});

		return { used: use, finished: newMl === 0 };
	}

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

			// liquor shot handling
			if (item.is_liquor && it.shot_ml) {
				let remainingNeeded = (it.quantity ?? 1) * it.shot_ml;

				// loop until all ml satisfied (handles multi-bottle consumption)
				while (remainingNeeded > 0) {
					// find oldest open bottle with > 0 ml
					let openBottle = await tx.openLiquorBottle.findFirst({
						where: { item_id: item.id, status: "OPEN", ml_remaining: { gt: 0 } },
						orderBy: { opened_at: "asc" }
					});

					// if none open, break a new bottle (will throw if out of stock)
					if (!openBottle) {
						openBottle = await breakBottle(tx, item.id);
					}

					// deduct as much as possible from this bottle
					const { used, finished } = await deductFromBottle(tx, openBottle.id, remainingNeeded, kot.id);

					remainingNeeded -= used;

					if (finished) {
						finishedBottleIds.push(openBottle.id);
					}
				}
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
	try {
		if (Array.isArray(finishedBottleIds) && finishedBottleIds.length > 0) {
			for (const b of finishedBottleIds) {
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
