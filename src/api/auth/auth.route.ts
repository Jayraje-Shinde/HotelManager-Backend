import { Router } from "express";
import { login } from "./auth.controller";

const router = Router();

router.post("/", login);

export default router;