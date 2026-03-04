import { Router } from "express";
import { closeDayController, reopenDayController, getDayEndController, precheckDayend } from "./dayend.controller";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";

const router = Router();

router.post(
	"/close",
	auth,
	allowRoles("admin", "manager"),
	closeDayController
);

router.post(
	"/reopen",
	auth,
	allowRoles("admin"),
	reopenDayController
);

// precheck MUST come before /:date — otherwise Express matches "precheck" as the date param
router.get(
	"/precheck",
	auth,
	allowRoles("admin", "cashier"),
	precheckDayend
);

router.get(
	"/:date",
	auth,
	allowRoles("admin", "manager", "accountant"),
	getDayEndController
);
export default router;
