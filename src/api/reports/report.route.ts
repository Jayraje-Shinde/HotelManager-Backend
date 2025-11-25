import { Router } from "express";

import { search } from "./report.controller";
const router = Router();

router.get('/', search);

export default router;