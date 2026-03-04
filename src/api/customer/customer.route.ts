import { Router } from "express";
import { create, getAll, getById, update, remove } from "./customer.controller";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";

const router = Router();

router.post("/",   auth, allowRoles("admin", "cashier"), create);
router.get("/",    auth, allowRoles("admin", "cashier", "manager"), getAll);
router.get("/:id", auth, allowRoles("admin", "cashier", "manager"), getById);
router.put("/:id", auth, allowRoles("admin", "cashier"), update);
router.delete("/:id", auth, allowRoles("admin"), remove);

export default router;
