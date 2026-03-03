import { Router } from "express";
import * as ctrl from "./billing.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.get("/", auth, ctrl.getopenbills);
router.get("/all", auth, ctrl.getAllbills);
router.get("/:billid", auth, ctrl.getBillByID);
router.post("/:id/close",auth, ctrl.closeBill);
router.post("/:id/pay",auth, ctrl.pay);
router.post("/", auth, ctrl.createBill);
router.put("/assign", auth, ctrl.assignWaiter);


export default router;
