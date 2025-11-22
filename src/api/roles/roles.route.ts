import { Router } from "express";
import { createRole, getAllRoles, deleteRole } from "./roles.controller";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/", auth, allowRoles("admin"), createRole); // POST /api/roles → create new role
router.get("/", auth, allowRoles("admin", "manager"), getAllRoles); // GET /api/roles → list all roles
router.delete("/:id", auth, allowRoles("admin"), deleteRole); // DELETE /api/roles -> deletes the role whos id is passed

export default router;
