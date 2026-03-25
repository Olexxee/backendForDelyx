import logger from "../../lib/logger.js";
import Joi from "joi";
import mongoose from "mongoose";

// Helper to validate MongoDB ObjectId
const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

/**
 * BODY Schemas
 * (these are used for POST/PUT where data comes from req.body)
 */
export const sendBuddyRequestSchema = Joi.object({
  userId: Joi.string().custom(objectId).required(),
});

export const acceptConnectionSchema = Joi.object({
  connectionId: Joi.string().custom(objectId).required(),
});

export const blockBuddyUserSchema = Joi.object({
  userId: Joi.string().custom(objectId).required(),
});

export const removeBuddyConnectionSchema = Joi.object({
  userId: Joi.string().custom(objectId).required(),
});

/**
 * QUERY Schemas
 * (these are used for GET endpoints where data comes from req.query)
 */
export const listBuddyConnectionsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  page: Joi.number().integer().min(1).default(1),
});

export const getConnectionDetailsSchema = Joi.object({
  requesterId: Joi.string().custom(objectId).required(),
  recipientId: Joi.string().custom(objectId).required(),
});
