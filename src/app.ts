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
const allowedOrigins = [
  "http://localhost:5173",
  env.CLIENT_URL,
].filter(Boolean) as string[];

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

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../client", "dist", "index.html"));
  });
}

// Error handling middleware should be last
app.use(errorHandler);

export default app;
