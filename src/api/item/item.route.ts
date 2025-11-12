import { Router } from "express";
import { createItem, UpdateItem, deleteItem, GetAllItems } from './item.controller';

const router = Router();

router.get("/", GetAllItems);
router.post("/", createItem);
router.put("/:id", UpdateItem);
router.delete("/:id", deleteItem);

export default router;