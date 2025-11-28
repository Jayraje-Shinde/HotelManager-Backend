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
import { blockIfDayClosed } from "../../middleware/blockIfDayClosed";

const router = Router();

router.post("/", auth, blockIfDayClosed({ field: "created_at", source: "body" }), createKOTHandler);
router.post("/:id/send", auth, sendKOTHandler);
router.post("/:id/serve", auth, serveKOTHandler);
router.post("/:id/close", auth, closeKOTHandler);
router.post("/:id/cancel", auth, blockIfDayClosed({ lookup: { model: "kot", idParam: "id", dateField: "created_at" } }), cancelKOTHandler);
router.get("/", auth, getAllKOTsHandler);

export default router;
