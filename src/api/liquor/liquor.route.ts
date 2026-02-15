// src/modules/liquor/liquor.route.ts

import { Router } from "express";
import * as ctrl from "./liquor.controller";

const router = Router();

router.get("/open", ctrl.getOpen);
router.post("/:itemId/break", ctrl.breakBottle);

export default router;
