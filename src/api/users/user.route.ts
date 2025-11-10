import { Router } from "express";
import { createUser, getAllUsers, deleteUser, updateUser } from "./user.controller";

const router = Router();

router.post("/", createUser);     // POST /api/users
router.get("/", getAllUsers);     // GET /api/users
router.delete("/:id", deleteUser); // DELETE /api/users/:id
router.put("/:id", updateUser); //PUT /api/users/:id

export default router;
