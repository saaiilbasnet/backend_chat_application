import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { UserIdType } from "../types/global.types.ts";
import logger from "./logger.ts";
import { env } from "../config/env.ts";

const app = express();
const server = http.createServer(app);

// CLIENT_URL can be a comma-separated list of allowed origins
const clientUrls = env.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean);

const allowedOrigins = ["http://localhost:5173", ...clientUrls];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// userId -> socketIds. A user can have multiple tabs/devices connected.
const userSocketMap: Record<string, Set<string>> = {};

interface SocketAuthPayload extends JwtPayload {
  userId: string;
}

type AuthenticatedSocket = Socket & {
  data: {
    userId?: string;
  };
};

const parseCookies = (cookieHeader: string | undefined) => {
  return Object.fromEntries(
    (cookieHeader ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.split("=");
        return [decodeURIComponent(key), decodeURIComponent(value.join("="))];
      }),
  );
};

const isSocketAuthPayload = (payload: string | JwtPayload): payload is SocketAuthPayload => {
  return typeof payload !== "string" && typeof payload.userId === "string";
};

function verifySocketUserId(socket: Socket): string | null {
  const token = parseCookies(socket.handshake.headers.cookie).jwt;
  if (!token || token === "undefined" || token === "null") return null;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    return isSocketAuthPayload(decoded) ? decoded.userId : null;
  } catch {
    return null;
  }
}

export function getReceiverSocketIds(userId: UserIdType): string[] {
  return Array.from(userSocketMap[String(userId)] ?? []);
}

export function emitToUsers(
  userIds: string[],
  event: string,
  payload: unknown,
  excludeUserId?: string,
): void {
  for (const userId of userIds) {
    if (excludeUserId && userId === excludeUserId) continue;
    const socketIds = getReceiverSocketIds(userId);
    if (socketIds.length > 0) {
      io.to(socketIds).emit(event, payload);
    }
  }
}

io.use((socket: AuthenticatedSocket, next) => {
  const userId = verifySocketUserId(socket);
  if (!userId) {
    logger.warn(`Rejected unauthenticated socket connection: ${socket.id}`);
    next(new Error("Unauthorized"));
    return;
  }

  socket.data.userId = userId;
  next();
});

io.on("connection", (socket: AuthenticatedSocket) => {
  logger.info(`A user connected: ${socket.id}`);

  // Log all incoming events
  // socket.onAny((event, ...args) => {
  //   logger.debug(`Socket IN [${event}] from ${socket.id}:`, args);
  // });

  // // Log all outgoing events
  // socket.onAnyOutgoing((event, ...args) => {
  //   logger.debug(`Socket OUT [${event}] to ${socket.id}:`, args);
  // });

  const userId = socket.data.userId;

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
