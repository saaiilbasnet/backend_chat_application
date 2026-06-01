import express, { Request, Response } from "express";
import cors from "cors";
import { app } from "./lib/socket.ts";
import authRoutes from "./routes/authRoutes.ts";
import messageRoutes from "./routes/messageRoute.ts";
import cookieParser from "cookie-parser";
import path from "path";
import { errorHandler } from "./middlewares/error.middleware.ts";
import { env } from "./config/env.ts";

app.use(express.json({ limit: "50mb" }));
const __dirname = path.resolve();

// Allowed origins for CORS
// CLIENT_URL can be a comma-separated list of allowed origins
const clientUrls = env.CLIENT_URL
  ? env.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean)
  : [];

const allowedOrigins = [
  "http://localhost:5173",
  ...clientUrls,
];

// cors config
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// cookie parsing
app.use(cookieParser());

// Routes setup
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Chat Application Backend API is running");
});

// Error handling middleware should be last
app.use(errorHandler);

export default app;
