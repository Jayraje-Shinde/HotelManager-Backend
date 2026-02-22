import prisma from "../../config/db";
import { Prisma } from "@prisma/client";

/* ============================================================
	CREATE KOT
============================================================ */
export async function createKOT(payload: {
	table_no: string;
	waiter_id?: number | null;
}) {
	if (!payload.table_no) throw new Error("table_required");

	const count = await prisma.kOT.count({
		where: { table_no: payload.table_no }
	});

	return prisma.kOT.create({
		data: {
			table_no: payload.table_no,
			waiter_id: payload.waiter_id ?? null,
			kot_no: `${payload.table_no}-KOT-${count + 1}`,
			status: "OPEN"
		}
	});
}
export async function getKOTbyBillid(
	id: number
) {
	if (!id) throw new Error("Bill ID REQUIRED");

	const res = await prisma.kOT.findMany({
  where: {
    bill_id: id
  },
  include: {
    items: {
      include: {
        item: {
          select: {
            name: true
          }
        }
      }
    }
  }
});

	return res;
}

/* ============================================================
	ADD ITEM TO KOT
============================================================ */
export async function addItemToKOT(
	kotId: number,
	payload: {
		item_id: number;
		quantity: number;
		sale_mode?: "BOTTLE" | "SHOT";
		ml_per_shot?: number;
	}
) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "OPEN") throw new Error("kot_not_editable");

	const item = await prisma.item.findUnique({
		where: { id: payload.item_id }
	});

	if (!item) throw new Error("item_not_found");

	if (item.is_liquor) {
		if (!payload.sale_mode)
			throw new Error("sale_mode_required_for_liquor");

		if (payload.sale_mode === "SHOT" && !payload.ml_per_shot)
			throw new Error("ml_per_shot_required");
	}

	return prisma.kOTItem.create({
		data: {
			kot_id: kotId,
			item_id: payload.item_id,
			quantity: payload.quantity,
			sale_mode: payload.sale_mode ?? null,
			ml_per_shot: payload.ml_per_shot ?? null
		}
	});
}

/* ============================================================
	SERVE
============================================================ */
export async function serveKOT(kotId: number) {
	return prisma.kOT.update({
		where: { id: kotId },
		data: { status: "SERVED" }
	});
}

/* ============================================================
	CLOSE KOT (REAL BAR MODE)
============================================================ */
export async function closeKOT(kotId: number) {
	return prisma.$transaction(async (tx: Prisma.TransactionClient) => {

		const kot = await tx.kOT.findUnique({
			where: { id: kotId },
			include: { items: true }
		});

		if (!kot) throw new Error("kot_not_found");
		if (kot.status !== "SERVED")
			throw new Error("invalid_kot_state");

		let bill = await tx.bill.findFirst({
			where: {
				table_no: kot.table_no,
				status: "OPEN"
			}
		});

		if (!bill) {
			bill = await tx.bill.create({
				data: {
					table_no: kot.table_no,
					user_id: kot.waiter_id ?? null,
					status: "OPEN"
				}
			});
		}

		for (const ki of kot.items) {

			const item = await tx.item.findUnique({
				where: { id: ki.item_id }
			});

			if (!item) throw new Error("item_not_found");

			const qty = ki.quantity;
			let rate: number;

			if (item.is_liquor && ki.sale_mode === "SHOT") {
				if (!item.peg_price_per_ml)
					throw new Error("peg_price_not_defined");

				rate = ki.ml_per_shot! * item.peg_price_per_ml;
			} else {
				rate = item.selling_price;
			}

			const subtotal = qty * rate;


			const billItem = await tx.billItem.create({
				data: {
					bill_id: bill.id,
					item_id: item.id,
					quantity: qty,
					rate,
					subtotal,
					sale_mode: ki.sale_mode ?? null,
					ml_per_shot: ki.ml_per_shot ?? null
				}
			});

			/* -----------------------------------------------
				NON LIQUOR
			-----------------------------------------------*/
			if (!item.is_liquor && item.manage_stock) {

				if ((item.stock ?? 0) < qty)
					throw new Error("insufficient_stock");

				await tx.item.update({
					where: { id: item.id },
					data: {
						stock: (item.stock ?? 0) - qty
					}
				});

				continue;
			}

			/* -----------------------------------------------
				LIQUOR SALE
			-----------------------------------------------*/
			if (item.is_liquor) {

				if (ki.sale_mode === "BOTTLE") {
					await sellSealedBottle(tx, item, qty, kot.id);
				}

				else if (ki.sale_mode === "SHOT") {
					await consumeShot(
						tx,
						item,
						qty,
						ki.ml_per_shot!,
						billItem.id,
						kot.id
					);
				}

				else {
					throw new Error("invalid_sale_mode");
				}
			}
		}

		const sum = await tx.billItem.aggregate({
			where: { bill_id: bill.id },
			_sum: { subtotal: true }
		});

		await tx.bill.update({
			where: { id: bill.id },
			data: { total: sum._sum.subtotal ?? 0 }
		});

		await tx.kOT.update({
			where: { id: kot.id },
			data: {
				status: "CLOSED",
				bill_id: bill.id
			}
		});

		await tx.tableStatus.upsert({
			where: { table_no: kot.table_no },
			update: {
				status: "OCCUPIED",
				current_bill_id: bill.id
			},
			create: {
				table_no: kot.table_no,
				zone: "",
				status: "OCCUPIED",
				current_bill_id: bill.id
			}
		});

		return { billId: bill.id };
	});
}

/* ============================================================
	Delete Item From KOT
============================================================ */

export async function deleteItemFromKOT(
	kotId: number,
	payload: {
		kot_item_id: number;
	}
) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "OPEN") throw new Error("kot_not_editable");

	const item = await prisma.kOTItem.findUnique({
		where: { id: payload.kot_item_id }
	});

	if (!item) throw new Error("item_not_found");

	return prisma.kOTItem.delete({
		where : {
			id : payload.kot_item_id,
			kot_id : kotId
		}
	});
}




/* ============================================================
	Update Item QTY
============================================================ */
export async function updateQtyOfIteminKOT(
	kotId: number,
	payload: {
		kot_item_id: number;
		quantity_to_update : number
	}
) {
	const kot = await prisma.kOT.findUnique({ where: { id: kotId } });
	if (!kot) throw new Error("kot_not_found");
	if (kot.status !== "OPEN") throw new Error("kot_not_editable");

	const item = await prisma.kOTItem.findUnique({
		where: { id: payload.kot_item_id }
	});

	if (!item) throw new Error("item_not_found");



	if((item.quantity + payload.quantity_to_update) == 0) return deleteItemFromKOT(kotId, {kot_item_id : item.id});
	if((item.quantity + payload.quantity_to_update) < 0) throw new Error("Cannot Go Below Zero");

	return prisma.kOTItem.update({
		data : {
		quantity : payload.quantity_to_update + item.quantity
		},
		where : {
			id : payload.kot_item_id,
			kot_id : kotId
		}
	});
}


/* ============================================================
	SEALED BOTTLE SALE
============================================================ */
async function sellSealedBottle(
	tx: Prisma.TransactionClient,
	item: any,
	quantity: number,
	kotId: number
) {
	let remaining = quantity;

	while (remaining > 0) {
		const batch = await tx.purchaseBatch.findFirst({
			where: {
				item_id: item.id,
				qty_remaining: { gt: 0 }
			},
			orderBy: { created_at: "asc" }
		});

		if (!batch)
			throw new Error("no_sealed_stock");

		const consume = Math.min(
			remaining,
			batch.qty_remaining
		);

		await tx.purchaseBatch.update({
			where: { id: batch.id },
			data: {
				qty_remaining: batch.qty_remaining - consume
			}
		});

		await tx.stockMovement.create({
			data: {
				item_id: item.id,
				change_qty: -consume,
				movement_type: "SALE",
				reason: `Sealed bottle sale via KOT ${kotId}`,
				ref_id: kotId,
				purchaseBatchId: batch.id
			}
		});

		remaining -= consume;
	}
}

/* ============================================================
	SHOT CONSUMPTION
============================================================ */
async function consumeShot(
	tx: Prisma.TransactionClient,
	item: any,
	quantity: number,
	mlPerShot: number,
	billItemId: number,
	kotId: number
) {
	let totalMlRequired = quantity * mlPerShot;

	while (totalMlRequired > 0) {

		let bottle = await tx.openLiquorBottle.findFirst({
			where: {
				item_id: item.id,
				status: "OPEN",
				ml_remaining: { gt: 0 }
			},
			orderBy: { opened_at: "asc" }
		});

		// Auto-break ONLY when shot is requested
		if (!bottle) {
			bottle = await breakBottleInternal(tx, item, kotId);
		}

		const usable = Math.min(
			bottle.ml_remaining,
			totalMlRequired
		);

		const newRemaining = bottle.ml_remaining - usable;

		await tx.openLiquorBottle.update({
			where: { id: bottle.id },
			data: {
				ml_remaining: newRemaining,
				status: newRemaining === 0 ? "FINISHED" : "OPEN",
				closed_at: newRemaining === 0 ? new Date() : null
			}
		});

		await tx.liquorShotUsage.create({
			data: {
				bill_item_id: billItemId,
				open_bottle_id: bottle.id,
				ml_used: usable,
				kot_id: kotId
			}
		});

		totalMlRequired -= usable;
	}
}

/* ============================================================
	INTERNAL BREAK (AUTO FOR SHOT ONLY)
============================================================ */
async function breakBottleInternal(
	tx: Prisma.TransactionClient,
	item: any,
	kotId: number
) {
	const batch = await tx.purchaseBatch.findFirst({
		where: {
			item_id: item.id,
			qty_remaining: { gt: 0 }
		},
		orderBy: { created_at: "asc" }
	});

	if (!batch)
		throw new Error("no_sealed_stock");

	await tx.purchaseBatch.update({
		where: { id: batch.id },
		data: {
			qty_remaining: batch.qty_remaining - 1
		}
	});

	await tx.stockMovement.create({
		data: {
			item_id: item.id,
			change_qty: -1,
			movement_type: "OPEN_BOTTLE",
			reason: `Auto break for shot via KOT ${kotId}`,
			ref_id: kotId,
			purchaseBatchId: batch.id
		}
	});

	return tx.openLiquorBottle.create({
		data: {
			item_id: item.id,
			ml_remaining: item.ml_per_unit,
			status: "OPEN",
			batch_id: batch.id
		}
	});
}
