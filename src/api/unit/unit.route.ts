import { Router } from "express";
import { createUnit, getAllUnit, deleteUnit } from "./unit.controller";


const router = Router();


router.post("/", createUnit); // POST /api/unit → create new Unit
router.get("/", getAllUnit); // GET /api/unit → list all Units
router.delete("/:id", deleteUnit); // DELETE /api/unit -> deletes the Unit whos id is passed


export default router;