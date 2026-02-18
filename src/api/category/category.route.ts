import { Router } from "express";
import { getAllCategory, deleteCategory, createCategory, updateCategory } from './category.controller';

import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";
const router = Router();

router.get("/", auth, allowRoles("cashier","waiter", "admin"), getAllCategory);
router.post("/", auth, allowRoles("admin"), createCategory);
router.put("/:id", auth, allowRoles("admin"), updateCategory);
router.delete("/:id", auth, allowRoles("admin"), deleteCategory);

export default router;