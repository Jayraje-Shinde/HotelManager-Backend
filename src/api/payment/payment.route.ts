import { Router } from "express";
import { addPaymentHandler } from "./payment.controller";
import { allowRoles } from "../../middleware/role";
import { auth } from "../../middleware/auth";

import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";

const router = Router();

router.post(
	"/:billId", auth, allowRoles("admin", "cashier"), blockIfDayClosed({ lookup: { model: "bill", idParam: "id", dateField: "bill_date" } }),
	addPaymentHandler
);

export default router;
