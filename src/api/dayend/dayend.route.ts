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

router.get(
	"/:date",
	auth,
	allowRoles("admin", "manager", "accountant"),
	getDayEndController
);

router.get(
	"/precheck",
	auth,
	allowRoles("admin", "cashier"),
	precheckDayend
);
export default router;
