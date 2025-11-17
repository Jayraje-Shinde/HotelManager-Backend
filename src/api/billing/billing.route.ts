import { Router } from "express";
import { createBilling, payBill, getBillById, deleteBill } from "./billing.controller";

const router = Router();

// First billing attempt: auto-generate bill items from SERVED KOTs and accept initial payment(s).
router.post("/", createBilling);

// Subsequent payments (partial payments)
router.post("/:id/pay", payBill);

// fetch
router.get("/:id", getBillById);

router.delete("/:id", deleteBill);
export default router;
