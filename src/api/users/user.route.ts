import { Router } from "express";
import { createUser, getAllUsers, deleteUser, updateUser,getAllWaiters } from "./user.controller";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";

const router = Router();

router.post("/", auth, allowRoles("admin", "cashier"), createUser);     // POST /api/users
router.get("/", auth, allowRoles("admin"), getAllUsers);     // GET /api/users
router.get("/waiter", auth, getAllWaiters);     // GET /api/users
router.delete("/:id", auth, allowRoles("admin"), deleteUser); // DELETE /api/users/:id
router.put("/:id", auth, allowRoles("admin", "cashier"), updateUser); //PUT /api/users/:id

export default router;
