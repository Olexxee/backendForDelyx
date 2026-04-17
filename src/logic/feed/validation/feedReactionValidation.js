import Joi from "joi";

export const FEED_REACTION_TARGET_TYPES = ["post", "comment"];
export const FEED_REACTION_TYPES = ["like"];

export const reactToTargetSchema = Joi.object({
  user: Joi.string().required(),
  targetType: Joi.string()
    .valid(...FEED_REACTION_TARGET_TYPES)
    .required(),
  targetId: Joi.string().required(),
  reactionType: Joi.string()
    .valid(...FEED_REACTION_TYPES)
    .default("like"),
});

export const unreactToTargetSchema = Joi.object({
  user: Joi.string().required(),
  targetType: Joi.string()
    .valid(...FEED_REACTION_TARGET_TYPES)
    .required(),
  targetId: Joi.string().required(),
});
