import { Router } from "express";
import { createItem, getAllItems, getItem, deleteItem } from "./item.controller";

const router = Router();

router.post("/", createItem);
router.get("/", getAllItems);
router.get("/:id", getItem);
router.delete("/:id", deleteItem);

export default router;
