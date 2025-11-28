import { Router } from "express";
import {
	createPurchaseHandler,
	getAllPurchasesHandler,
	getPurchaseHandler, deletePurchase
} from "./purchase.controller";
import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/", auth, allowRoles("admin", "manager"), blockIfDayClosed({ field: "purchase_date", source: "body" }), createPurchaseHandler);
router.get("/", auth, allowRoles("admin", "manager"), getAllPurchasesHandler);
router.get("/:id", auth, allowRoles("admin", "manager"), getPurchaseHandler);
router.delete("/:id", auth, allowRoles("admin"), blockIfDayClosed({ lookup: { model: "purchase", idParam: "id", dateField: "purchase_date" } }), deletePurchase);

export default router;
