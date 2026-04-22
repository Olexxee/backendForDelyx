import Joi from "joi";

export const FEED_POST_CONTEXT_TYPES = [
  "general",
  "group",
  "tournament",
  "match",
];

export const FEED_POST_VISIBILITY = [
  "public",
  "group_members",
  "tournament_participants",
  "private",
];

export const FEED_POST_STATUS = ["active", "hidden", "deleted", "flagged"];

const ensurePostHasContentOrMedia = (value, helpers) => {
  const content =
    typeof value.content === "string" ? value.content.trim() : "";
  const media = Array.isArray(value.media) ? value.media.filter(Boolean) : [];

  if (!content && media.length === 0) {
    return helpers.error("any.invalid");
  }

  return value;
};

const ensureContextMatchesVisibility = (value, helpers) => {
  const { contextType = "general", contextId = null, visibility = "public" } =
    value;

  if (contextType !== "general" && !contextId) {
    return helpers.message(
      "contextId is required when contextType is not 'general'.",
    );
  }

  if (contextType === "general" && contextId) {
    return helpers.message(
      "contextId must be null when contextType is 'general'.",
    );
  }

  if (visibility === "group_members" && contextType !== "group") {
    return helpers.message(
      "visibility 'group_members' requires group context.",
    );
  }

  if (
    visibility === "tournament_participants" &&
    contextType !== "tournament"
  ) {
    return helpers.message(
      "visibility 'tournament_participants' requires tournament context.",
    );
  }

  return value;
};

export const createFeedPostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(2000).default(""),

  media: Joi.array().items(Joi.string()).default([]),

  contextType: Joi.string()
    .valid(...FEED_POST_CONTEXT_TYPES)
    .default("general"),

  contextId: Joi.string().allow(null).default(null),

  visibility: Joi.string()
    .valid(...FEED_POST_VISIBILITY)
    .default("public"),
})
  .custom(ensurePostHasContentOrMedia, "post content/media validation")
  .custom(ensureContextMatchesVisibility, "context/visibility validation");

export const updateFeedPostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(2000),
  media: Joi.array().items(Joi.string()),
  visibility: Joi.string().valid(...FEED_POST_VISIBILITY),
})
  .min(1)
  .custom(ensurePostHasContentOrMedia, "post content/media validation");

export const listFeedPostsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  status: Joi.string()
    .valid(...FEED_POST_STATUS)
    .default("active"),
  contextType: Joi.string().valid(...FEED_POST_CONTEXT_TYPES),
  contextId: Joi.string().allow(null),
  author: Joi.string(),
});