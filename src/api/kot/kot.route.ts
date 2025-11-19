import { Router } from "express";

import {
	createKOTHandler,
	sendKOTHandler,
	serveKOTHandler,
	closeKOTHandler,
	cancelKOTHandler,
	getAllKOTsHandler
} from "./kot.controller";

const router = Router();

router.post("/", createKOTHandler);
router.post("/:id/send", sendKOTHandler);
router.post("/:id/serve", serveKOTHandler);
router.post("/:id/close", closeKOTHandler);
router.post("/:id/cancel", cancelKOTHandler);
router.get("/", getAllKOTsHandler);

export default router;
