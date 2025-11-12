import express from "express";
import cors from "cors";
import roleRoutes from './api/roles/roles.route';
import userRoutes from './api/users/user.route';
import categoryRoutes from './api/category/category.route';
import unitRoutes from './api/unit/unit.route';
import itemRoutes from './api/item/item.route';

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/api/role", roleRoutes);
app.use("/api/user", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/unit", unitRoutes);
app.use("/api/item", itemRoutes);

export default app;
