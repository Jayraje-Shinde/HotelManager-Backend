import { Router } from "express";

import {
	createKOTHandler,
	sendKOTHandler,
	serveKOTHandler,
	closeKOTHandler,
	cancelKOTHandler,
	getAllKOTsHandler
} from "./kot.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/", auth, createKOTHandler);
router.post("/:id/send", auth, sendKOTHandler);
router.post("/:id/serve", auth, serveKOTHandler);
router.post("/:id/close", auth, closeKOTHandler);
router.post("/:id/cancel", auth, cancelKOTHandler);
router.get("/", auth, getAllKOTsHandler);

export default router;
