import client from "./bullmqRedis.js";
import { Queue } from "bullmq";

export const domainEventQueue = new Queue("domainEventQueue", {
  connection: client,
});

export const enqueueDomainEvent = async (eventName, data, options = {}) => {
  return domainEventQueue.add(eventName, data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
    ...options,
  });
};
