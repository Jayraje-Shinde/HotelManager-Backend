import express from "express";
import cors from "cors";
import roleRoutes from './api/roles/roles.route';
import userRoutes from './api/users/user.route';
import categoryRoutes from './api/category/category.route';

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);

export default app;
