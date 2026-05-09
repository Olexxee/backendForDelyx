import mongoose from "mongoose";
import ChatRoom from "./chatRoomSchema.js";
import { BadRequestError } from "../lib/classes/errorClasses.js";

const assertValidObjectId = (id, field = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError(`Invalid ${field}`);
  }
};

/**
 * Generic chat room query builder.
 * Use this when the service wants to chain .sort(), .lean(), .select(), etc.
 */
export const findChatRooms = (filter = {}) => {
  return ChatRoom.find(filter);
};

/**
 * Find chat room by context.
 */
export const findChatByContext = ({ contextType, contextId }) => {
  return ChatRoom.findOne({ contextType, contextId });
};

/**
 * Create a new chat room.
 */
export const createChatRoom = ({
  participants,
  contextType,
  contextId,
  aesKey,
}) => {
  return ChatRoom.create({
    participants,
    contextType,
    contextId,
    aesKey,
  });
};

/**
 * Find chat room by ID.
 */
export const findChatById = (chatRoomId) => {
  assertValidObjectId(chatRoomId, "chatRoomId");
  return ChatRoom.findById(chatRoomId);
};

/**
 * Alias expected by chatService.js.
 */
export const getChatRoom = findChatById;

/**
 * Update chat room metadata.
 */
export const updateChatRoom = (chatRoomId, update, options = {}) => {
  assertValidObjectId(chatRoomId, "chatRoomId");

  return ChatRoom.findByIdAndUpdate(chatRoomId, update, {
    new: true,
    ...options,
  });
};

/**
 * List chat rooms for a user.
 * Use this only when passing a plain userId.
 */
export const findChatsForUser = (userId) => {
  assertValidObjectId(userId, "userId");

  return ChatRoom.find({ participants: userId })
    .populate("participants", "username profilePicture")
    .sort({ lastMessageAt: -1, updatedAt: -1 });
};

export const findChatRoomsByGroupIds = (groupIds) => {
  return ChatRoom.find({
    contextType: "group",
    contextId: { $in: groupIds },
  })
    .select("_id contextId")
    .lean();
};
