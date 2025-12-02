
import { Router } from "express";
import { getSalesRegister } from "./sale-register.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier"), getSalesRegister);

export default router;
