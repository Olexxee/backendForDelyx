import Joi from "joi";

export const createGroupSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  privacy: Joi.string().valid("public", "private", "protected").optional(),
  avatar: Joi.any().optional(),
});

export const updateGroupSchema = Joi.object({
  name: Joi.string().min(3).max(50).optional(),
  bio: Joi.string().min(10).max(500).allow("").optional(),
});
