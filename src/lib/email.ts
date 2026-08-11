import sgMail from "@sendgrid/mail";
import { env } from "../config/env.ts";
import logger from "./logger.ts";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

export const sendEmail = async (options: SendEmailOptions) => {
  if (!env.SENDGRID_API_KEY) {
    logger.warn("SENDGRID_API_KEY not found. Email not sent.");
    return false;
  }

  try {
    const [response] = await sgMail.send({
      from: options.from || env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    logger.info(`Email sent via SendGrid: ${response.statusCode}`);
    return true;
  } catch (error) {
    logger.error("Error sending email via SendGrid: " + (error as Error).message);
    return false;
  }
};
