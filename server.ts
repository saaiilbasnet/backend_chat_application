import { config } from "dotenv";
config();
import { server } from "./src/lib/socket.ts";
import "./src/app.ts";
import { connectDB } from "./src/database/connection.ts";
import logger from "./src/lib/logger.ts";

const startServer = () => {
  const port = process.env.PORT;
  server.listen(port, () => {
    logger.info(`Server started at http://localhost:${port}`);
  });
  connectDB();
};

startServer();
