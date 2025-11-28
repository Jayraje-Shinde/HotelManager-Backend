import { Router } from "express";

import { breakBottleHandler, getOpenBottlesHandler, closeBottleHandler } from "./bottle.controller";

import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";
import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";

const router = Router();

router.post("/break", auth, allowRoles("waiter", "admin", "cashier"), blockIfDayClosed({ lookup: { model: "openLiquorBottle", idParam: "id", dateField: "opened_at" } }), breakBottleHandler);
router.get("/open", blockIfDayClosed({ field: "opened_at", source: "body" }), getOpenBottlesHandler);
router.put("/close/:id", auth, allowRoles("waiter", "admin", "cashier"), closeBottleHandler);



export default router;