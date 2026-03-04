import { Router } from "express";
import * as ctrl from "./billing.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/",               auth, ctrl.createBill);
router.get("/",                auth, ctrl.getopenbills);
router.get("/:billid",         auth, ctrl.getBillByID);
router.post("/:id/close",      auth, ctrl.closeBill);
router.post("/:id/pay",        auth, ctrl.pay);

// Mark a closed bill as credit (udhar) and link a customer
router.post("/:id/credit",     auth, ctrl.markCredit);

// Assign customer to a bill (before or after close)
router.put("/assign-customer", auth, ctrl.assignCustomer);

// Assign waiter to a bill
router.put("/assign",          auth, ctrl.assignWaiter);

export default router;
