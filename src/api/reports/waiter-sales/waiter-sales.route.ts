import { Router } from "express";
import { getWaiterSales } from "./waiter-sales.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier"), getWaiterSales);

export default router;
