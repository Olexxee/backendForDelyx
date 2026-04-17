import Joi from "joi";

export const FEED_COMMENT_STATUS = ["active", "hidden", "deleted", "flagged"];

export const createFeedCommentSchema = Joi.object({
  post: Joi.string().required(),
  author: Joi.string().required(),
  content: Joi.string().trim().min(1).max(1000).required(),
  parentComment: Joi.string().allow(null).default(null),
  status: Joi.string()
    .valid(...FEED_COMMENT_STATUS)
    .default("active"),
});

export const updateFeedCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required(),
});

export const listFeedCommentsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid(...FEED_COMMENT_STATUS)
    .default("active"),
});
