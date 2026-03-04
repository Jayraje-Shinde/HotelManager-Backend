import { Router } from "express";
import { vendorLedger, customerLedger, outstandingReport, agingReport, vendorsSummary } from "./ledger.controller";
import { auth } from "../../middleware/auth";
import { allowRoles } from "../../middleware/role";

const router = Router();

const accountingRoles = allowRoles("admin", "manager");

// Outstanding report — who owes what
router.get("/outstanding",          auth, accountingRoles, outstandingReport);

// Aging report — overdue analysis in buckets
router.get("/aging",                auth, accountingRoles, agingReport);

// All vendors with their outstanding balances
router.get("/vendors",              auth, accountingRoles, vendorsSummary);

// Full vendor ledger statement
router.get("/vendor/:id",           auth, accountingRoles, vendorLedger);

// Full customer ledger statement
router.get("/customer/:id",         auth, accountingRoles, customerLedger);

export default router;
