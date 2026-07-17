import { config } from "dotenv";
config();
import { server } from "./src/lib/socket.ts";
import "./src/app.ts";
import { connectDB } from "./src/database/connection.ts";
import logger from "./src/lib/logger.ts";
import { connectCache, disconnectCache } from "./src/lib/cache.ts";
import { closeQueues, startQueueWorkers } from "./src/lib/queues.ts";
import { env } from "./src/config/env.ts";

const startServer = () => {
  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`Server started at http://0.0.0.0:${env.PORT}`);
  });
  connectDB();
  connectCache();
  startQueueWorkers();
};

startServer();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down server.`);
  server.close(async () => {
    await Promise.all([disconnectCache(), closeQueues()]);
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
