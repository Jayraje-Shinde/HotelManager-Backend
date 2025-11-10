import express from "express";
import cors from "cors";
import roleRoutes from './api/roles/roles.route';
import userRoutes from './api/users/user.route';

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

export default app;
