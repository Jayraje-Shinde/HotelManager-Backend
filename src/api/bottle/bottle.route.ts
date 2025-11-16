import { Router } from "express";

import { breakBottleHandler, getOpenBottlesHandler, closeBottleHandler } from "./bottle.controller";

const router = Router();

router.post("/break", breakBottleHandler);
router.get("/open", getOpenBottlesHandler);
router.put("/close/:id", closeBottleHandler);



export default router;