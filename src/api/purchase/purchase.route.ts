import { Router } from "express";
import { createPurchase, getAllPurchases } from "./purchase.controller";

const router = Router();

router.post("/", createPurchase);
router.get("/", getAllPurchases);

export default router;
