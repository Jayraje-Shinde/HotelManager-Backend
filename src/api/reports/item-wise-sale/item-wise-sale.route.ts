import { Router } from "express";
import { getItemWiseSales } from "./item-wise-sale.controller";

import { auth } from "../../../middleware/auth";
import { allowRoles } from "../../../middleware/role";

const router = Router();

router.get("/", auth, allowRoles("admin", "cashier"), getItemWiseSales);

export default router;
