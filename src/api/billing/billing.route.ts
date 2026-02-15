import { Router } from "express";
import * as ctrl from "./billing.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.get("/", auth, ctrl.getopenbills);
router.post("/:id/close",auth, ctrl.closeBill);
router.post("/:id/pay",auth, ctrl.pay);

export default router;
