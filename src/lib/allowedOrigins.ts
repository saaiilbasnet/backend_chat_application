import { env } from "../config/env.ts";

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

// CLIENT_URL can be a comma-separated list of allowed origins
const clientUrls = env.CLIENT_URL
  ? env.CLIENT_URL.split(",").map((url) => stripTrailingSlash(url.trim())).filter(Boolean)
  : [];

export const allowedOrigins = ["http://localhost:5173", ...clientUrls];
