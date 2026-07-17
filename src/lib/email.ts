import nodemailer from "nodemailer";
import { env } from "../config/env.ts";
import logger from "./logger.ts";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const smtpPort = Number(env.SMTP_PORT);

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendEmail = async (options: SendEmailOptions) => {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn("SMTP credentials not found. Email not sent.");
    return false;
  }

  try {
    const result = await transporter.sendMail({
      from: {
        name: "Zeno Chat",
        address: options.from || env.SMTP_FROM_EMAIL,
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    logger.info(`Email sent via SMTP: ${result.messageId}`);
    return true;
  } catch (error) {
    logger.error("Error sending email via SMTP: " + (error as Error).message);
    return false;
  }
};
