import { Router } from "express";
import { addPaymentHandler } from "./payment.controller";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";


const router = Router();

router.post(
	"/:billId", auth, allowRoles("admin", "cashier"),
	addPaymentHandler
);

export default router;
