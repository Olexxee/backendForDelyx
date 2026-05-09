import { Worker } from "bullmq";
import client from "../../queues/bullmqRedis.js";
import { handleChatMessageCreated } from "../../event/handlers/chatEventHandler.js";
import { EVENT_TYPES } from "../../event/eventTypes.js";

import {
  handleFixtureCompleted,
  handleTournamentStarted,
  handleTournamentCompleted,
  handleTournamentFixturesGenerated,
} from "../../event/handlers/tournamentEventHandlers.js";

import {
  handleFeedPostCommented,
  handleFeedPostCommentDeleted,
  handleFeedPostReacted,
  handleFeedPostUnreacted,
  handleFeedCommentReacted,
  handleFeedCommentUnreacted,
} from "../../event/handlers/feedEventHandlers.js";

const handlers = {
  // ─── Tournament ────────────────────────────────────────────────────────────
  [EVENT_TYPES.FIXTURE_COMPLETED]: handleFixtureCompleted,
  [EVENT_TYPES.TOURNAMENT_STARTED]: handleTournamentStarted,
  [EVENT_TYPES.TOURNAMENT_COMPLETED]: handleTournamentCompleted,
  [EVENT_TYPES.TOURNAMENT_FIXTURES_GENERATED]:
    handleTournamentFixturesGenerated,

  // ─── Feed ──────────────────────────────────────────────────────────────────
  [EVENT_TYPES.FEED_POST_COMMENTED]: handleFeedPostCommented,
  [EVENT_TYPES.FEED_POST_COMMENT_DELETED]: handleFeedPostCommentDeleted,
  [EVENT_TYPES.FEED_POST_REACTED]: handleFeedPostReacted,
  [EVENT_TYPES.FEED_POST_UNREACTED]: handleFeedPostUnreacted,
  [EVENT_TYPES.FEED_COMMENT_REACTED]: handleFeedCommentReacted,
  [EVENT_TYPES.FEED_COMMENT_UNREACTED]: handleFeedCommentUnreacted,

  // ─── Chat ──────────────────────────────────────────────────────────────────
  [EVENT_TYPES.CHAT_MESSAGE_CREATED]: handleChatMessageCreated,
};

export const domainEventWorker = new Worker(
  "domainEventQueue",
  async (job) => {
    const handler = handlers[job.name];

    if (!handler) {
      console.warn(`[DomainEventWorker] No handler for event: ${job.name}`);
      return;
    }

    await handler(job.data.payload, job.data);
  },
  {
    connection: bullMQRedis,
    concurrency: 5,
  },
);

domainEventWorker.on("completed", (job) => {
  console.info(`[DomainEventWorker] Completed event: ${job.name}`);
});

domainEventWorker.on("failed", (job, error) => {
  console.error(`[DomainEventWorker] Failed event: ${job?.name}`, error);
});
