import { Router } from "express";

import { breakBottleHandler, getOpenBottlesHandler, closeBottleHandler } from "./bottle.controller";

import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/break", auth, allowRoles("waiter", "admin", "cashier"), breakBottleHandler);
router.get("/open", getOpenBottlesHandler);
router.put("/close/:id", auth, allowRoles("waiter", "admin", "cashier"), closeBottleHandler);



export default router;