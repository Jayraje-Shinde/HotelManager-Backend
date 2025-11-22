import { Router } from "express";
import {
	createPurchaseHandler,
	getAllPurchasesHandler,
	getPurchaseHandler, deletePurchase
} from "./purchase.controller";

import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/", auth, allowRoles("admin", "manager"), createPurchaseHandler);
router.get("/", auth, allowRoles("admin", "manager"), getAllPurchasesHandler);
router.get("/:id", auth, allowRoles("admin", "manager"), getPurchaseHandler);
router.delete("/:id", auth, allowRoles("admin"), deletePurchase);

export default router;
