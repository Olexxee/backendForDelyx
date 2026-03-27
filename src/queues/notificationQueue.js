import client  from "./bullmqRedis.js";
import { Queue } from "bullmq";

export const notificationQueue = new Queue("notificationQueue", {
  connection: client,
});

export const enqueueNotificationJob = async (jobName, data) => {
  await notificationQueue.add(jobName, data);
};