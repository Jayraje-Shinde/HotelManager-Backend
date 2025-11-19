import { Router } from "express";
import {
	createBillHandler,
	createBillFromKOTHandler,
	addPaymentToBillHandler,
	getBillHandler,
	rollbackBillHandler
} from "./billing.controller";

const router = Router();

router.post("/", createBillHandler);                 // manual/ad-hoc bill
router.post("/from-kot", createBillFromKOTHandler);  // consolidate KOT(s) -> bill
router.post("/:id/pay", addPaymentToBillHandler);    // add payments to an existing bill
router.get("/:id", getBillHandler);                  // get bill details
router.delete("/:id", rollbackBillHandler);          // rollback (admin)

export default router;
