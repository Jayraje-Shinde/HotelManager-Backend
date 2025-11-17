import { Router } from "express";
import {
	createPurchaseHandler,
	getAllPurchasesHandler,
	getPurchaseHandler, deletePurchase
} from "./purchase.controller";

const router = Router();

router.post("/", createPurchaseHandler);
router.get("/", getAllPurchasesHandler);
router.get("/:id", getPurchaseHandler);
router.delete("/:id", deletePurchase);

export default router;
