import { Router } from "express";
import * as ctrl from "./kot.controller";
import { auth } from "../../middleware/auth";
const router = Router();

router.post("/",auth, ctrl.create);

router.post("/:id/items",auth, ctrl.addItem);
router.post("/:id/serve",auth, ctrl.serve);
router.post("/:id/close",auth, ctrl.close);

export default router;
