import { config } from "dotenv";
config();
import dns from "node:dns";
// Render's network has unreliable IPv6 egress; Node prefers IPv6 DNS
// results by default (RFC 6724), which causes outbound connections
// (e.g. Gmail SMTP) to hang and time out instead of falling back to IPv4.
dns.setDefaultResultOrder("ipv4first");
import { server } from "./src/lib/socket.ts";
import "./src/app.ts";
import { connectDB } from "./src/database/connection.ts";
import logger from "./src/lib/logger.ts";
import { env } from "./src/config/env.ts";

const startServer = () => {
  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`Server started at http://0.0.0.0:${env.PORT}`);
  });
  connectDB();
};

startServer();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down server.`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
