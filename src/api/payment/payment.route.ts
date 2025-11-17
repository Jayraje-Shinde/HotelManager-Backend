import { Router } from "express";
import { addPaymentHandler } from "./payment.controller";

const router = Router();

router.post(
	"/:billId",
	addPaymentHandler
);

export default router;
