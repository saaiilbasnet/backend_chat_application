import mongoose from "mongoose";
import { env } from "../config/env.ts";
import logger from "../lib/logger.ts";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error("MongoDB connection error: " + error);
  }
};
