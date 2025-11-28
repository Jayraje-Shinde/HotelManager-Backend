import { Router } from "express";
import {
	createBillHandler,
	createBillFromKOTHandler,
	addPaymentToBillHandler,
	getBillHandler,
	rollbackBillHandler
} from "./billing.controller";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";
import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";


const router = Router();

router.post("/", auth, blockIfDayClosed({ field: "bill_date", source: "body" }), createBillHandler);                 // manual/ad-hoc bill
router.post("/from-kot", auth, blockIfDayClosed({ lookup: { model: "bill", idParam: "id", dateField: "bill_date" } }), createBillFromKOTHandler);  // consolidate KOT(s) -> bill
router.post("/:id/pay", auth, blockIfDayClosed({ lookup: { model: "bill", idParam: "id", dateField: "bill_date" } }), addPaymentToBillHandler);    // add payments to an existing bill
router.get("/:id", auth, getBillHandler);                  // get bill details
router.delete("/:id", auth, allowRoles("admin"), rollbackBillHandler);          // rollback (admin)

export default router;
