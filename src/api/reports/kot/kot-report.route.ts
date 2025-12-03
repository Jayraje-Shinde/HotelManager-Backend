import { Router } from "express";
import { getKOTReport } from "./kot-report.controller";
import { getCancelledKOTReport } from "./kot-cancelled-report.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier", "waiter"), getKOTReport);
router.get("/cancelled", auth, allowRoles("admin", "cashier", "waiter"), getCancelledKOTReport);

export default router;
