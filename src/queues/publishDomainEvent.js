import { enqueueDomainEvent } from "../queues/domainEventQueue.js";

export const publishDomainEvent = async (eventName, payload, options = {}) => {
  if (!eventName) {
    throw new Error("eventName is required");
  }

  return enqueueDomainEvent(
    eventName,
    {
      eventName,
      payload,
      occurredAt: new Date().toISOString(),
    },
    options,
  );
};
