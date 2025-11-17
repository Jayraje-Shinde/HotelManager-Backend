import { Router } from "express";
import {
	createKOTHandler,
	sendKOTHandler,
	serveKOTHandler,
	cancelKOTHandler,
	closeKOTHandler,
	getAllKot
} from "./kot.controller";

const router = Router();
router.get('/', getAllKot);
router.post("/", createKOTHandler);            // create
router.post("/:id/send", sendKOTHandler);      // send to kitchen
router.post("/:id/serve", serveKOTHandler);    // mark served
router.post("/:id/cancel", cancelKOTHandler);  // cancel and rollback shot usages
router.post("/:id/close", closeKOTHandler);    // close KOT (final)

export default router;
