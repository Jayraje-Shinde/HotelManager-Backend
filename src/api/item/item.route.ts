import { Router } from "express";
import {
	createLiquor,
	createNonLiquor,
	getItems,
	getItem,
	updateItem,
	deleteItem
} from "./item.controller";


import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

const router = Router();

// Liquor creation (multiple bottle sizes)
router.post("/liquor", auth, allowRoles("admin"), createLiquor);

// Non-liquor item creation
router.post("/", auth, allowRoles("admin"), createNonLiquor);

// Read
router.get("/", auth, allowRoles("admin", "cashier", "waiter"), getItems);
router.get("/:id", auth, allowRoles("admin", "cashier", "waiter"), getItem);

// Update
router.put("/:id", auth, allowRoles("admin"), updateItem);

// Delete
router.delete("/:id", auth, allowRoles("admin"), deleteItem);

export default router;
