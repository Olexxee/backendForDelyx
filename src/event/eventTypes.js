export const EVENT_TYPES = {
  FIXTURE_COMPLETED: "FIXTURE_COMPLETED",
  TOURNAMENT_STARTED: "TOURNAMENT_STARTED",
  TOURNAMENT_COMPLETED: "TOURNAMENT_COMPLETED",
  TOURNAMENT_FIXTURES_GENERATED: "TOURNAMENT_FIXTURES_GENERATED",
  CHAT_MESSAGE_CREATED: "CHAT_MESSAGE_CREATED",
};


// ─── Feed Event Types ─────────────────────────────────────────────────────────

export const FEED_EVENT_TYPES = {
  // Comment lifecycle
  FEED_POST_COMMENTED:        "feed.post.commented",
  FEED_POST_COMMENT_DELETED:  "feed.post.comment_deleted",

  // Reaction lifecycle
  FEED_POST_REACTED:          "feed.post.reacted",
  FEED_POST_UNREACTED:        "feed.post.unreacted",
  FEED_COMMENT_REACTED:       "feed.comment.reacted",
  FEED_COMMENT_UNREACTED:     "feed.comment.unreacted",
};

// ─── Usage ────────────────────────────────────────────────────────────────────
// In eventTypes.js, merge like so:
//
// export const EVENT_TYPES = {
//   // ...existing tournament events...
//   ...FEED_EVENT_TYPES,
// };