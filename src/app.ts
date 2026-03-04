import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import roleRoutes from './api/roles/roles.route';
import userRoutes from './api/users/user.route';
import categoryRoutes from './api/category/category.route';
import unitRoutes from './api/unit/unit.route';
import itemRoutes from './api/item/item.route';
import stockMovementRoutes from './api/stock_movement/stock_movement.route';
import vendorRoutes from './api/vendor/vendor.route';
import purchaseRoutes from './api/purchase/purchase.route';
import purchaseBatchRoutes from './api/purchase-batch/purchaseBatch.route'
import breakBottleroute from "./api/bottle/bottle.route";
import paymentRoutes from "./api/payment/payment.route";
import kotrRoutes from './api/kot/kot.route';
import billingRoutes from './api/billing/billing.route';
import authRoutes from './api/auth/auth.route';
import reportsRoutes from './api/reports/report.route';
import dayendRoutes from './api/dayend/dayend.route';
import customerRouter from "./api/customer/customer.route";


//testing middleware just for dev
import { requestLogger } from "./middleware/logger";

const app = express();

app.use(requestLogger);
app.use( cors({ origin: "http://localhost:5173", credentials: true }) );
app.use(express.json());
app.use(cookieParser());

// routes
app.get("/check", function (req, res) { res.send({ "status": "ok" }) });
app.use("/api/role", roleRoutes);
app.use("/api/user", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/unit", unitRoutes);
app.use("/api/item", itemRoutes);
app.use("/api/stockmovement", stockMovementRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/purchase-batch", purchaseBatchRoutes);
app.use("/api/bottle", breakBottleroute);
app.use("/api/bills", billingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/kots", kotrRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/report", reportsRoutes);
app.use('/api/dayend', dayendRoutes);
app.use("/api/customer", customerRouter);

export default app;
