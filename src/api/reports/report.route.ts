import { Router } from "express";
import purchaseRegister from "./purchase-register/purchase-register.route";
import { search } from "./report.controller";
import salesRegister from "./sale-register/sale-register.route";
const router = Router();

router.get('/', search);
router.use('/purchase-register', purchaseRegister);
router.use('/sale-register', salesRegister);
export default router;