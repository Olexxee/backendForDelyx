import logger from "../../lib/logger.js";
import { asyncWrapper } from "../../lib/utils.js";
import { ValidationException } from "../../lib/classes/errorClasses.js";
import { validator } from "../../lib/classes/validatorClass.js";
import * as buddyService from "./buddyConnectionService.js";
import {
  sendBuddyRequestSchema,
  acceptConnectionSchema,
  blockBuddyUserSchema,
  removeBuddyConnectionSchema,
  listBuddyConnectionsSchema,
  getConnectionDetailsSchema,
} from "./buddyRequest.js";

// Send buddy request
export const sendBuddyRequest = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(sendBuddyRequestSchema, req.body);
  if (error) throw new ValidationException(error);

  const result = await buddyService.sendBuddyRequest(req.user.id, value.userId);
  res.status(200).json({ success: true, data: result });
});


// Accept connection
export const acceptConnection = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(acceptConnectionSchema, req.params);
  if (error) throw new ValidationException(error);

  const result = await buddyService.acceptConnection(value.connectionId, req.user.id);
  res.status(200).json({ success: true, data: result });
});

// Block user
export const blockBuddyUser = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(blockBuddyUserSchema, req.params);
  if (error) throw new ValidationException(error);

  const result = await buddyService.blockBuddyUser(req.user.id, value.userId);
  res.status(200).json({ success: true, data: result });
});

// Unblock
export const unblockBuddyUser = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(blockBuddyUserSchema, req.params);
  if (error) throw new ValidationException(error);

  const result = await buddyService.unblockBuddyUser(req.user.id, value.userId);
  res.status(200).json({ success: true, data: result });
});

// Remove buddy connection
export const removeBuddyConnection = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(removeBuddyConnectionSchema, req.params);
  if (error) throw new ValidationException(error);

  const result = await buddyService.removeConnection(req.user.id, value.userId);
  res.status(200).json({ success: true, data: result });
});

// List buddy connections
export const listBuddyConnections = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(listBuddyConnectionsSchema, req.query);
  if (error) throw new ValidationException(error);

  const result = await buddyService.listBuddyConnections(req.user._id, "accepted", value);
  res.status(200).json({ success: true, data: result });
});

// Get connection details
export const getConnectionDetailsController = asyncWrapper(async (req, res) => {
  const { error, value } = validator.validate(getConnectionDetailsSchema, req.params);
  if (error) throw new ValidationException(error);

  const connection = await buddyService.getConnectionDetails(value.requesterId, value.recipientId);

  res.status(200).json({
    success: true,
    data: connection,
  });
});
