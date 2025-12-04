import { Router } from "express";
import { getDailySalesQty } from "./daily-sales-qty.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier"), getDailySalesQty);

export default router;
