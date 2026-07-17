import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "MONGODB_URI",
  "CLIENT_URL"
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

const optionalString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const requiredString = (key: (typeof requiredEnv)[number]) => {
  const value = optionalString(process.env[key]);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const numberFromEnv = (key: string, fallback: number) => {
  const rawValue = process.env[key];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }

  return value;
};

export const env = {
  JWT_SECRET: requiredString("JWT_SECRET"),
  CLOUDINARY_CLOUD_NAME: requiredString("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requiredString("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requiredString("CLOUDINARY_API_SECRET"),
  MONGODB_URI: requiredString("MONGODB_URI"),
  CLIENT_URL: requiredString("CLIENT_URL"),
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: numberFromEnv("SMTP_PORT", 465),
  SMTP_USER: optionalString(process.env.SMTP_USER) || optionalString(process.env.EMAIL_USER) || "basnetssahil@gmail.com",
  SMTP_PASS: optionalString(process.env.SMTP_PASS) || optionalString(process.env.APP_PASSWORD),
  SMTP_FROM_EMAIL: optionalString(process.env.SMTP_FROM_EMAIL) || optionalString(process.env.SMTP_USER) || optionalString(process.env.EMAIL_USER) || "basnetssahil@gmail.com",
  REDIS_URL: optionalString(process.env.REDIS_URL),
  CACHE_TTL_SECONDS: numberFromEnv("CACHE_TTL_SECONDS", 60),
  EMAIL_QUEUE_CONCURRENCY: numberFromEnv("EMAIL_QUEUE_CONCURRENCY", 5),
} as const;
