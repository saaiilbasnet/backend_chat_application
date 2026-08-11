import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "MONGODB_URI"
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
  NODE_ENV: optionalString(process.env.NODE_ENV) ?? "development",
  PORT: numberFromEnv("PORT", 3000),
  JWT_SECRET: requiredString("JWT_SECRET"),
  CLOUDINARY_CLOUD_NAME: requiredString("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requiredString("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requiredString("CLOUDINARY_API_SECRET"),
  MONGODB_URI: requiredString("MONGODB_URI"),
  CLIENT_URL: optionalString(process.env.CLIENT_URL) ?? "",
  SENDGRID_API_KEY: optionalString(process.env.SENDGRID_API_KEY),
  EMAIL_FROM: optionalString(process.env.EMAIL_FROM) ?? "basnetssahil@gmail.com",
} as const;
