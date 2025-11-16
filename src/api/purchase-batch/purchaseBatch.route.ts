import { Router } from "express";
import {
	getBatchesByItemHandler,
	getBatchByIdHandler,
	getAllBatchesHandler
} from "./purchaseBatch.controller";

const router = Router();

router.get("/", getAllBatchesHandler);
router.get("/:batchId", getBatchByIdHandler);
router.get("/item/:itemId", getBatchesByItemHandler);

export default router;
