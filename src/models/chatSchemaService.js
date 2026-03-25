import logger from "../lib/logger.js";
import ChatRoom from "./chatRoomSchema.js";

/**
 * Find a chat room by context
 */
export const findChatByContext = async (contextType, contextId) => {
  return ChatRoom.findOne({ contextType, contextId });
};

/**
 * Create a new chat room
 */
export const createChatRoom = async ({
  participants,
  contextType,
  contextId,
}) => {
  return ChatRoom.create({
    participants,
    contextType,
    contextId,
  });
};

/**
 * Find chat room by ID
 */
export const findChatById = async (chatId) => {
  return ChatRoom.findById(chatId);
};

/**
 * List chat rooms for a user
 */
export const findChatsForUser = async (userId) => {
  return ChatRoom.find({ participants: userId })
    .populate("participants", "username profilePicture")
    .sort({ updatedAt: -1 });
};
