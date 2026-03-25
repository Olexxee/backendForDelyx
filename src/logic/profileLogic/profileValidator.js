import logger from "../lib/logger.js";
import Joi from "joi";

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  bio: Joi.string().max(500),
  interests: Joi.array().items(Joi.string()),
  gender: Joi.string().valid("male", "female", "non-binary", "other"),
  lookingFor: Joi.string().valid("male", "female", "any"),
  tribe: Joi.string().max(50),
  birthDate: Joi.date().less("now").iso(),
  profilePicture: Joi.string().uri(),
  visibility: Joi.string().valid("public", "friends-only", "private"),
  mediaGallery: Joi.array().items(
    Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().valid("image", "video").default("image"),
    })
  ),
});
