// src/modules/liquor/liquor.service.ts

import prisma from "../../config/db";
import { Prisma } from "@prisma/client";

/* ============================================================
   BREAK BOTTLE (MANUAL)
============================================================ */
export async function breakBottle(itemId: number, userId: number) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item || !item.is_liquor)
      throw new Error("invalid_liquor_item");

    const batch = await tx.purchaseBatch.findFirst({
      where: {
        item_id: itemId,
        qty_remaining: { gt: 0 }
      },
      orderBy: { created_at: "asc" }
    });

    if (!batch)
      throw new Error("no_sealed_stock_available");

    await tx.purchaseBatch.update({
      where: { id: batch.id },
      data: { qty_remaining: batch.qty_remaining - 1 }
    });

    await tx.stockMovement.create({
      data: {
        item_id: itemId,
        change_qty: -1,
        movement_type: "OPEN_BOTTLE",
        reason: "Manual bottle break",
        created_by: userId,
        purchaseBatchId: batch.id
      }
    });

    return tx.openLiquorBottle.create({
      data: {
        item_id: itemId,
        ml_remaining: item.ml_per_unit,
        status: "OPEN",
        batch_id: batch.id
      }
    });
  });
}

/* ============================================================
   GET OPEN BOTTLES
============================================================ */
export async function getOpenBottles(itemId?: number) {
  return prisma.openLiquorBottle.findMany({
    where: {
      status: "OPEN",
      ...(itemId ? { item_id: itemId } : {})
    },
    orderBy: { opened_at: "asc" }
  });
}

/* ============================================================
   CONSUME PEG FROM OPEN BOTTLE
   (Used internally by KOT close)
============================================================ */
export async function consumeFromOpenBottle(
  tx: Prisma.TransactionClient,
  item: any,
  quantity: number,
  billItemId: number,
  kotId: number
) {
  let mlRequired = quantity * item.ml_per_unit;

  while (mlRequired > 0) {

    const bottle = await tx.openLiquorBottle.findFirst({
      where: {
        item_id: item.id,
        status: "OPEN",
        ml_remaining: { gt: 0 }
      },
      orderBy: { opened_at: "asc" }
    });

    if (!bottle)
      throw new Error("no_open_bottle_available");

    const usable = Math.min(bottle.ml_remaining, mlRequired);
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

    mlRequired -= usable;
  }
}
