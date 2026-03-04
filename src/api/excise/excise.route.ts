import { Router } from "express";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";
import * as ctrl from "./excise.controller";

const router = Router();
const roles  = allowRoles("admin", "manager");

// ── Legally required Maharashtra excise registers ──────────────────

// FLR-1/A: Brand-wise daily stock register (fill before close each day)
// GET /api/excise/flr1a?date=2026-03-01
router.get("/flr1a",              auth, roles, ctrl.flr1aReport);

// FLR-3/A: Monthly transaction register
// GET /api/excise/flr3a?month=2026-03
router.get("/flr3a",              auth, roles, ctrl.flr3aReport);

// FLR-4: Monthly excise statement (submit to excise officer)
// GET /api/excise/flr4?month=2026-03
router.get("/flr4",               auth, roles, ctrl.flr4Report);

// ── Business-critical compliance reports ──────────────────────────

// Daily consumption: opening + purchases - closing vs sales
// GET /api/excise/consumption?date=2026-03-01
router.get("/consumption",        auth, roles, ctrl.consumption);

// Breakage register (all bottle breakages with MRP loss)
// GET /api/excise/breakage?from=2026-03-01&to=2026-03-31
router.get("/breakage",           auth, roles, ctrl.breakage);

// GST-separated sales (food=GST, liquor=no GST)
// GET /api/excise/gst-sales?from=2026-03-01&to=2026-03-31
router.get("/gst-sales",          auth, roles, ctrl.gstSales);

// Stock variance report (theoretical vs actual ml per brand)
// GET /api/excise/stock-variance?from=2026-03-01&to=2026-03-31&threshold=50
router.get("/stock-variance",     auth, roles, ctrl.stockVariance);

// Purchase register with excise details
// GET /api/excise/purchase-register?from=2026-03-01&to=2026-03-31&vendor_id=1
router.get("/purchase-register",  auth, roles, ctrl.purchaseRegisterExcise);

export default router;
