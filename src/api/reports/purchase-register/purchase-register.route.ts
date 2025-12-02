import { Router } from "express";
import { getPurchaseRegister } from "./purchase-register.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier"), getPurchaseRegister);

export default router;
