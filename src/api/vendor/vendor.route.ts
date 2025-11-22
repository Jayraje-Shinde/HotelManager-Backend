import { Router } from "express";
import { create, getAll, remove } from "./vendor.controller";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/", auth, allowRoles("admin", "cashier"), create);
router.get("/", getAll);
router.delete("/:id", auth, allowRoles("admin"), remove);

export default router;
