import express from "express";
import cors from "cors";
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

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.get("/check", function (req, res) { res.send("") });
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

export default app;
