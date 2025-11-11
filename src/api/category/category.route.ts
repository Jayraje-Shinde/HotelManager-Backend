import { Router } from "express";
import { getAllCategory, deleteCategory, createCategory, updateCategory } from './category.controller';
const router = Router();

router.get("/", getAllCategory);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
