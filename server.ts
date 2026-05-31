import { config } from "dotenv";
config();
import { server } from "./src/lib/socket.ts";
import "./src/app.ts";
import { connectDB } from "./src/database/connection.ts";
import logger from "./src/lib/logger.ts";

const startServer = () => {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, "0.0.0.0", () => {
    logger.info(`Server started at http://0.0.0.0:${port}`);
  });
  connectDB();
};

startServer();
