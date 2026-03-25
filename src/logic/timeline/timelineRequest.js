import Joi from "joi";

/**
 * =========================
 * CREATE POST
 * =========================
 */
export const createPostSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),

  visibility: Joi.string()
    .valid("public", "friends", "private")
    .default("public"),

  tags: Joi.array().items(Joi.string().trim().max(30)).max(20).default([]),
});

/**
 * =========================
 * FEED QUERY
 * =========================
 */
export const feedQerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(50).default(10),

  scope: Joi.string().valid("default", "friends", "me").default("default"),
});

/**
 * =========================
 * ADD COMMENT
 * =========================
 */
export const addCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),

  parentComment: Joi.string().hex().length(24).allow(null),
});

/**
 * =========================
 * PAGINATION (COMMENTS)
 * =========================
 */
export const listCommentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(50).default(20),
});
