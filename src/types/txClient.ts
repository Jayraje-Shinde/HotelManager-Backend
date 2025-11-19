import type { Prisma } from "@prisma/client";

export type TxClient = {
	item: Prisma.ItemDelegate;
	purchaseBatch: Prisma.PurchaseBatchDelegate;
	openLiquorBottle: Prisma.OpenLiquorBottleDelegate;
	billItem: Prisma.BillItemDelegate;
	stockMovement: Prisma.StockMovementDelegate;
	liquorShotUsage: Prisma.LiquorShotUsageDelegate;
	// add any other models your helper needs
};
