import { Router } from "express";
import { login, logout, me } from "./auth.controller";
import { auth } from "../../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", auth, me);

export default router;
