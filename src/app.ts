import express, { Request, Response } from "express";
import cors from "cors";
import { app } from "./lib/socket.ts";
import authRoutes from "./routes/authRoutes.ts";
import messageRoutes from "./routes/messageRoute.ts";
import friendRoutes from "./routes/friendRoutes.ts";
import groupRoutes from "./routes/groupRoutes.ts";
import cookieParser from "cookie-parser";
import path from "path";
import { errorHandler } from "./middlewares/error.middleware.ts";
import { allowedOrigins } from "./lib/allowedOrigins.ts";

app.use(express.json({ limit: "50mb" }));
const __dirname = path.resolve();

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
app.use("/api/friends", friendRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Chat Application Backend API is running");
});

// Error handling middleware should be last
app.use(errorHandler);

export default app;
