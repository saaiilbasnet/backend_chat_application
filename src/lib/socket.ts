import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";
import type { UserIdType } from "../types/global.types.ts";
import logger from "./logger.ts";

const app = express();
const server = http.createServer(app);

// CLIENT_URL can be a comma-separated list of allowed origins
const clientUrls = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean)
  : [];

const allowedOrigins = ["http://localhost:5173", ...clientUrls];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// userId -> socketIds. A user can have multiple tabs/devices connected.
const userSocketMap: Record<string, Set<string>> = {};

//   Normalize userId into a string usable as an object key

function normalizeUserId(userId: string | string[] | undefined): string | null {
  return typeof userId === "string" ? userId : null;
}

export function getReceiverSocketIds(userId: UserIdType): string[] {
  return Array.from(userSocketMap[String(userId)] ?? []);
}

io.use((socket, next) => {
  logger.info(`Socket connection attempt: ${socket.id} from ${socket.handshake.address}`);
  next();
});

io.on("connection", (socket: Socket) => {
  logger.info(`A user connected: ${socket.id}`);

  // Log all incoming events
  // socket.onAny((event, ...args) => {
  //   logger.debug(`Socket IN [${event}] from ${socket.id}:`, args);
  // });

  // // Log all outgoing events
  // socket.onAnyOutgoing((event, ...args) => {
  //   logger.debug(`Socket OUT [${event}] to ${socket.id}:`, args);
  // });

  const userId = normalizeUserId(socket.handshake.query.userId);

  if (userId) {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    logger.info(`A user disconnected: ${socket.id}`);

    if (userId) {
      userSocketMap[userId]?.delete(socket.id);
      if (userSocketMap[userId]?.size === 0) {
        delete userSocketMap[userId];
      }
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
