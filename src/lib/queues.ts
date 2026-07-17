import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.ts";
import { sendEmail } from "./email.ts";
import logger from "./logger.ts";
import { getReceiverSocketIds, io } from "./socket.ts";

type EmailJobData = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

type SocketEventJobData = {
  userIds: string[];
  event: string;
  payload: unknown;
  excludeUserId?: string;
};

const connection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : null;

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const emailQueue = connection
  ? new Queue<EmailJobData>("email", {
      connection,
      defaultJobOptions,
    })
  : null;

export const socketEventQueue = connection
  ? new Queue<SocketEventJobData>("socket-events", {
      connection,
      defaultJobOptions,
    })
  : null;

const emailQueueEvents = connection ? new QueueEvents("email", { connection }) : null;
const socketEventQueueEvents = connection ? new QueueEvents("socket-events", { connection }) : null;

let emailWorker: Worker<EmailJobData> | null = null;
let socketEventWorker: Worker<SocketEventJobData> | null = null;
let hasLoggedDirectEmailFallback = false;
const EMAIL_QUEUE_ADD_TIMEOUT_MS = 2000;

const emitSocketEvent = ({ userIds, event, payload, excludeUserId }: SocketEventJobData) => {
  for (const userId of userIds) {
    if (excludeUserId && userId === excludeUserId) continue;
    const socketIds = getReceiverSocketIds(userId);
    if (socketIds.length > 0) {
      io.to(socketIds).emit(event, payload);
    }
  }
};

export const enqueueEmail = async (data: EmailJobData) => {
  if (!emailQueue) {
    if (!hasLoggedDirectEmailFallback) {
      logger.info("Redis URL not configured. Sending email directly without queue.");
      hasLoggedDirectEmailFallback = true;
    }
    return sendEmail(data);
  }

  try {
    const addJob = emailQueue.add("send-email", data);
    await Promise.race([
      addJob,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timed out adding email job to queue")), EMAIL_QUEUE_ADD_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    logger.error("Error adding email job to queue: " + (error as Error).message);
    return sendEmail(data);
  }
};

export const enqueueSocketEvent = async (data: SocketEventJobData) => {
  if (!socketEventQueue) {
    emitSocketEvent(data);
    return true;
  }

  try {
    await socketEventQueue.add("emit-socket-event", data);
    return true;
  } catch (error) {
    logger.error("Error adding socket event job to queue: " + (error as Error).message);
    emitSocketEvent(data);
    return false;
  }
};

export const startQueueWorkers = () => {
  if (!connection) {
    logger.info("Redis URL not configured. Queue workers disabled.");
    return;
  }

  if (!emailWorker) {
    emailWorker = new Worker<EmailJobData>(
      "email",
      async (job) => {
        const sent = await sendEmail(job.data);
        if (!sent) {
          throw new Error(`Failed to send email to ${job.data.to}`);
        }
      },
      {
        connection,
        concurrency: env.EMAIL_QUEUE_CONCURRENCY,
      },
    );

    emailWorker.on("completed", (job) => {
      logger.info(`Email job completed: ${job.id}`);
    });

    emailWorker.on("failed", (job, error) => {
      logger.error(`Email job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    });
  }

  if (!socketEventWorker) {
    socketEventWorker = new Worker<SocketEventJobData>(
      "socket-events",
      async (job) => {
        emitSocketEvent(job.data);
      },
      {
        connection,
        concurrency: 20,
      },
    );

    socketEventWorker.on("failed", (job, error) => {
      logger.error(`Socket event job failed: ${job?.id ?? "unknown"} - ${error.message}`);
    });
  }

  emailQueueEvents?.on("error", (error) => {
    logger.error("Email queue event error: " + error.message);
  });

  socketEventQueueEvents?.on("error", (error) => {
    logger.error("Socket event queue event error: " + error.message);
  });

  logger.info("Queue workers started");
};

export const closeQueues = async () => {
  await Promise.all([
    emailWorker?.close(),
    socketEventWorker?.close(),
    emailQueueEvents?.close(),
    socketEventQueueEvents?.close(),
    emailQueue?.close(),
    socketEventQueue?.close(),
    connection?.quit(),
  ]);
};
