import prisma from "../../config/db";
import { CreateKOTInput, KOTItemInput, KOTStatus } from "../../types/kot";

/**
 * Create a KOT (per-table incremental numbering)
 * - creates KOT record
 * - creates KOT items
 * - creates a bill if none exists for the table (OPEN)
 * - for shots: deduct ml from open bottle, create LiquorShotUsage with kot_id for rollback
 */
export async function createKOT(payload: CreateKOTInput) {
	const { table_no, waiter_id, items } = payload;
	if (!items || items.length === 0) throw new Error("empty_kot");

	return prisma.$transaction(async (tx) => {
		// compute next kot number for table (per-table counter)
		const count = await tx.kOT.count({ where: { table_no } });
		const kot_no = `${table_no}-KOT-${count + 1}`;

		const kot = await tx.kOT.create({
			data: { table_no, waiter_id, kot_no, status: "OPEN" }
		});

		// find or create open bill for table
		let bill = await tx.bill.findFirst({ where: { table_no, status: "OPEN" } });
		if (!bill) {
			bill = await tx.bill.create({
				data: { table_no, user_id: waiter_id, status: "OPEN", total: 0, discount: 0, bill_date: new Date() }
			});
		}

		// link kot -> bill
		await tx.kOT.update({ where: { id: kot.id }, data: { bill_id: bill.id } });

		// process items
		for (const it of items) {
			await handleKOTItem(tx, kot.id, bill.id, it, waiter_id);
		}

		// mark table occupied
		await tx.tableStatus.upsert({
			where: { table_no },
			update: { status: "OCCUPIED", current_bill_id: bill.id },
			create: { table_no, zone: "", status: "OCCUPIED", current_bill_id: bill.id }
		});

		return { kot, bill_id: bill.id };
	});
}

/**
 * Helper — process each KOT item
 * - always create kot_item row
 * - if shot_ml & item.is_liquor => consume from open bottle (prompt if no bottle / insufficient)
 * - create liquorShotUsage with kot_id so we can rollback on cancellation
 */
async function handleKOTItem(tx: any, kot_id: number, bill_id: number, item: KOTItemInput, waiter_id: number) {
	const dbItem = await tx.item.findUnique({ where: { id: item.item_id } });
	if (!dbItem) throw new Error("item_not_found");

	// create KOTItem
	const kotItem = await tx.kOTItem.create({
		data: { kot_id, item_id: item.item_id, quantity: item.quantity, note: item.note ?? null }
	});

	// shot handling (real-time)
	if (dbItem.is_liquor && item.shot_ml) {
		const ml_needed = item.quantity * item.shot_ml;

		// find open bottle FIFO
		let open = await tx.openLiquorBottle.findFirst({
			where: { item_id: dbItem.id, status: "OPEN", ml_remaining: { gt: 0 } },
			orderBy: { opened_at: "asc" }
		});

		if (!open) {
			const err: any = new Error("PROMPT_BREAK_BOTTLE");
			err.item_id = dbItem.id;
			throw err;
		}

		if (open.ml_remaining < ml_needed) {
			const err: any = new Error("PROMPT_BREAK_BOTTLE");
			err.item_id = dbItem.id;
			err.open_bottle_id = open.id;
			err.ml_remaining = open.ml_remaining;
			err.remaining_ml_needed = ml_needed - open.ml_remaining;
			throw err;
		}

		// deduct ml and record usage with kot_id for rollback
		await tx.openLiquorBottle.update({
			where: { id: open.id },
			data: { ml_remaining: open.ml_remaining - ml_needed, status: open.ml_remaining - ml_needed === 0 ? "CLOSED" : open.status }
		});

		await tx.liquorShotUsage.create({
			data: {
				bill_item_id: null,
				open_bottle_id: open.id,
				kot_id,
				ml_used: ml_needed,
				used_at: new Date()
			}
		});
	}

	// non-liquor & sealed bottles -> nothing now (handled at billing)
}

/**
 * Send KOT to kitchen (mark SENT)
 * Only allowed if current status is OPEN
 */
export async function sendKOT(kotId: number, senderId?: number) {
	return prisma.$transaction(async (tx) => {
		const kot = await tx.kOT.findUnique({ where: { id: kotId } });
		if (!kot) throw new Error("kot_not_found");
		if (kot.status !== "OPEN") throw new Error("kot_invalid_state");

		const updated = await tx.kOT.update({ where: { id: kotId }, data: { status: "SENT", updated_at: new Date() } });
		return updated;
	});
}

/**
 * Mark KOT as served
 * Allowed only when status is SENT
 */
export async function serveKOT(kotId: number) {
	return prisma.$transaction(async (tx) => {
		const kot = await tx.kOT.findUnique({ where: { id: kotId } });
		if (!kot) throw new Error("kot_not_found");
		if (kot.status !== "SENT") throw new Error("kot_invalid_state");

		const updated = await tx.kOT.update({ where: { id: kotId }, data: { status: "SERVED", updated_at: new Date() } });
		return updated;
	});
}

/**
 * Cancel KOT and rollback shot usages associated with this KOT
 * - set kot.status = CANCELLED
 * - find liquorShotUsage rows with kot_id and revert ml to their open bottles
 * - delete those liquorShotUsage rows (or mark as rolled_back)
 */
export async function cancelKOT(kotId: number, reason?: string) {
	return prisma.$transaction(async (tx) => {
		const kot = await tx.kOT.findUnique({ where: { id: kotId } });
		if (!kot) throw new Error("kot_not_found");
		if (kot.status === "CANCELLED" || kot.status === "CLOSED") throw new Error("kot_already_finalized");

		// find shot usages created by this kot
		const usages = await tx.liquorShotUsage.findMany({ where: { kot_id: kotId } });

		// revert ml for each usage
		for (const u of usages) {
			const bottle = await tx.openLiquorBottle.findUnique({ where: { id: u.open_bottle_id } });
			if (!bottle) continue;
			const newMl = (bottle.ml_remaining ?? 0) + u.ml_used;

			await tx.openLiquorBottle.update({
				where: { id: bottle.id },
				data: {
					ml_remaining: newMl,
					status: "OPEN",
					closed_at: null
				}
			});
		}

		// delete or mark usages (we delete to keep simple)
		await tx.liquorShotUsage.deleteMany({ where: { kot_id: kotId } });

		// mark kot cancelled
		const updatedKot = await tx.kOT.update({
			where: { id: kotId },
			data: { status: "CANCELLED", updated_at: new Date(), /* optionally store reason */ }
		});

		// note: KOT cancellation does not touch bill (bill remains OPEN). Frontend should handle removing items from UI and then adjust bill at finalization.

		return updatedKot;
	});
}

/**
 * Close KOT (final housekeeping) — allowed only after SERVED
 * Marks CLOSED
 */
export async function closeKOT(kotId: number) {
	return prisma.$transaction(async (tx) => {
		const kot = await tx.kOT.findUnique({ where: { id: kotId } });
		if (!kot) throw new Error("kot_not_found");
		if (kot.status !== "SERVED" && kot.status !== "CANCELLED") throw new Error("kot_not_ready_to_close");

		const updated = await tx.kOT.update({ where: { id: kotId }, data: { status: "CLOSED", updated_at: new Date() } });
		return updated;
	});
}

/** Helpers: get KOTs by table / get open KOTs */
export async function getKOTsByTable(table_no: string) {
	return prisma.kOT.findMany({ where: { table_no }, include: { items: true } });
}

export async function getOpenKOTs() {
	return prisma.kOT.findMany({ where: { status: { in: ["OPEN", "SENT"] } }, include: { items: true } });
}

export async function getAll() {
	return await prisma.kOT.findMany({
		orderBy: { id: "desc" },
		include: { waiter: true, bill: true, items: true }
	});
}
