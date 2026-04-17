import Joi from "joi";

export const postIdParamSchema = Joi.object({
  postId: Joi.string().required(),
});

export const commentIdParamSchema = Joi.object({
  commentId: Joi.string().required(),
});

export const authorIdParamSchema = Joi.object({
  authorId: Joi.string().required(),
});

export const contextPostParamsSchema = Joi.object({
  contextType: Joi.string().valid("group", "tournament", "match").required(),
  contextId: Joi.string().required(),
});
