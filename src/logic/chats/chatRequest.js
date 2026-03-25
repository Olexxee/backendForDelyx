import logger from "../../lib/logger.js";
import Joi from "joi";
import mongoose from "mongoose";

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

export const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(1000),
  media: Joi.array().items(Joi.custom(objectId)).max(5),
}).or("content", "media");
