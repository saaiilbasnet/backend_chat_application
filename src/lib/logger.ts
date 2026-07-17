import winston from "winston";
import path from "path";
import fs from "fs";
import { env } from "../config/env.ts";

// Ensure logs directory exists
const logsDir = path.resolve("logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

// ── Console format: colorized, human-readable ──────────────────────────────
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `[${timestamp}] ${level}: ${stack ?? message}${metaStr}`;
  }),
);

// ── File format: structured JSON ────────────────────────────────────────────
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "warn" : "debug",
  transports: [
    // Console — all levels in dev, only warn+ in prod
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Persistent error log
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: fileFormat,
    }),

    // Combined log (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: fileFormat,
    }),
  ],
});

export default logger;
