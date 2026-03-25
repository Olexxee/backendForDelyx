import { bullMQRedis } from "./bullmqRedis.js";
import { Queue } from "bullmq";

export const notificationQueue = new Queue("notificationQueue", {
  connection: bullMQRedis,
});
