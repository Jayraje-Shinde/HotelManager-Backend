import express from "express";
import cors from "cors";
import roleRoutes from './api/roles/roles.route';

const app = express();
app.use(cors());
app.use(express.json());

// routes

app.use("/api/roles", roleRoutes);

export default app;
