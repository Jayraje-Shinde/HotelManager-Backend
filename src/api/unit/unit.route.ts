import { Router } from "express";
import { createUnit, getAllUnit, deleteUnit } from "./unit.controller";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";


const router = Router();


router.post("/", auth, allowRoles("admin", "manager"), createUnit); // POST /api/unit → create new Unit
router.get("/", auth, allowRoles("admin", "manager", "cashier", "manager"), getAllUnit); // GET /api/unit → list all Units
router.delete("/:id", auth, allowRoles("admin"), deleteUnit); // DELETE /api/unit -> deletes the Unit whos id is passed


export default router;