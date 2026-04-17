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

export const createFeedPostSchema = Joi.object({
  author: Joi.string().required(),

  content: Joi.string().trim().allow("").max(2000).default(""),

  media: Joi.array().items(Joi.string()).default([]),

  contextType: Joi.string()
    .valid(...FEED_POST_CONTEXT_TYPES)
    .default("general"),

  contextId: Joi.string().allow(null).default(null),

  visibility: Joi.string()
    .valid(...FEED_POST_VISIBILITY)
    .default("public"),

  status: Joi.string()
    .valid(...FEED_POST_STATUS)
    .default("active"),

  isPinned: Joi.boolean().default(false),
  isFeatured: Joi.boolean().default(false),
});

export const updateFeedPostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(2000),
  media: Joi.array().items(Joi.string()),
  visibility: Joi.string().valid(...FEED_POST_VISIBILITY),
  isPinned: Joi.boolean(),
  isFeatured: Joi.boolean(),
}).min(1);

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
