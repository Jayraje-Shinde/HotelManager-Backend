import { Router } from "express";
import purchaseRegister from "./purchase-register/purchase-register.route";
import { search } from "./report.controller";
import salesRegister from "./sale-register/sale-register.route";
import itemWiseSale from "./item-wise-sale/item-wise-sale.route";
import  kotReports  from "./kot/kot-report.route";
import waiterWiseReports from './waiter-sales/waiter-sales.route';
import dailySaleReports from './daily-sale-qty/daily-sales-qty.route';
const router = Router();

router.get('/', search);
router.use('/purchase-register', purchaseRegister);
router.use('/sale-register', salesRegister);
router.use('/item-wise-sale', itemWiseSale);
router.use('/kot', kotReports);
router.use('/waiter-wise', waiterWiseReports);
router.use('/daily-sale-qty', dailySaleReports);
export default router;