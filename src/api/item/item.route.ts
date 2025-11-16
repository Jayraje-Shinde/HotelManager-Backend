import { Router } from "express";
import {
	createLiquor,
	createNonLiquor,
	getItems,
	getItem,
	updateItem,
	deleteItem
} from "./item.controller";

const router = Router();

// Liquor creation (multiple bottle sizes)
router.post("/liquor", createLiquor);

// Non-liquor item creation
router.post("/", createNonLiquor);

// Read
router.get("/", getItems);
router.get("/:id", getItem);

// Update
router.put("/:id", updateItem);

// Delete
router.delete("/:id", deleteItem);

export default router;
