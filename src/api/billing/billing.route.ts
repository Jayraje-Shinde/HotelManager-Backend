import { Router } from "express";
import {
	createBillHandler,
	createBillFromKOTHandler,
	addPaymentToBillHandler,
	getBillHandler,
	rollbackBillHandler
} from "./billing.controller";
import { auth } from "../../middleware/auth";


const router = Router();

router.post("/", auth, createBillHandler);                 // manual/ad-hoc bill
router.post("/from-kot", auth, createBillFromKOTHandler);  // consolidate KOT(s) -> bill
router.post("/:id/pay", auth, addPaymentToBillHandler);    // add payments to an existing bill
router.get("/:id", auth, getBillHandler);                  // get bill details
router.delete("/:id", auth, rollbackBillHandler);          // rollback (admin)

export default router;
