import { Worker } from "bullmq";
import { bullMQRedis } from "../../queues/bullmqRedis.js";
import logger from "../../lib/logger.js";
import { jobHandlers } from "./notificationJobHandlers.js";

new Worker(
  "notificationQueue",
  async (job) => {
    const handler = jobHandlers[job.name];

    if (!handler) {
      logger.warn(`[NotificationWorker] No handler found for job: ${job.name}`);
      return;
    }

    await handler(job.data);
  },
  { connection: bullMQRedis },
);