import { Router } from "express";
import { createRole, getAllRoles, deleteRole } from "./roles.controller";

const router = Router();

router.post("/", createRole); // POST /api/roles → create new role
router.get("/", getAllRoles); // GET /api/roles → list all roles
router.delete("/:id", deleteRole); // DELETE /api/roles -> deletes the role whos id is passed

export default router;
