import { Router } from "express";
import * as ctrl from "./kot.controller";
import { auth } from "../../middleware/auth";
const router = Router();

router.post("/",auth, ctrl.create);
router.get("/", auth, ctrl.getKOTbyBillid);

router.post("/:id/items",auth, ctrl.addItem);
router.post("/:id/serve",auth, ctrl.serve);
router.post("/:id/close",auth, ctrl.close);


//updateing and deleted items from open KOT

router.put("/:id/items",auth,ctrl.updateQTYofItem);
router.delete("/:id/items", auth,ctrl.deleteItem);

export default router;
