import mongoose from "mongoose";
import ChatService from "./chatService.js";
import { asyncWrapper } from "../../lib/utils.js";
import { getOrCreateChatRoom } from "./chatRoomService.js";
import ChatBroadcaster from "./chatBroadcaster.js";

let broadcaster;

/**
 * Initialize broadcaster
 */
export const setIo = (ioInstance) => {
  broadcaster = new ChatBroadcaster(ioInstance);
  console.log(broadcaster ? "Broadcaster running" : "Failed to initialize broadcaster");
};

/**
 * ===============================
 * CHAT ROOM ENDPOINTS
 * ===============================
 */

/**
 * Get or create chat room by context
 */
export const getChatRoom = asyncWrapper(async (req, res) => {
  const { contextType, contextId } = req.params;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(contextId)) {
    throw new BadRequestError("Invalid contextId");
  }

  const chatRoom = await getOrCreateChatRoom({ contextType, contextId, userId });

  res.status(200).json({ success: true, data: { chatRoom } });
});



/**
 * Get user chat rooms
 */
export const getUserChatRooms = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit || 20);
  const skip = parseInt(req.query.skip || 0);

  const chatRooms = await ChatService.getUserChatRooms({ userId, limit, skip });

  res.status(200).json({ success: true, data: { chatRooms, count: chatRooms.length } });
});

/**
 * ===============================
 * MESSAGES ENDPOINTS
 * ===============================
 */

/**
 * Get messages from a chat room
 */
export const getMessages = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const limit = parseInt(req.query.limit || 50);
  const skip = parseInt(req.query.skip || 0);
  const userId = req.user.id;

  const messages = await ChatService.getMessages({ chatRoomId, userId, limit, skip });

  res.status(200).json({
    success: true,
    data: { messages, count: messages.length, hasMore: messages.length === limit },
  });
});

/**
 * Sync messages since a timestamp (offline sync)
 */
export const syncMessages = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const since = req.query.since;
  const limit = parseInt(req.query.limit || 50);
  const userId = req.user.id;

  const messages = await ChatService.getMessagesSince({ chatRoomId, userId, since, limit });

  res.status(200).json({ success: true, data: { messages, count: messages.length } });
});

/**
 * Send a message (text or media)
 */
export const sendMessage = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  const files = req.files || [];

  const message = await ChatService.createMessage({ chatRoomId, senderId: userId, content, files });

  broadcaster?.broadcastMessage(chatRoomId, message);

  res.status(201).json({ success: true, message: "Message sent successfully", data: { message } });
});

/**
 * Mark messages as read
 */
export const markMessagesAsRead = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.id;

  const updatedCount = await chatService.markRead({ chatRoomId, userId });

  broadcaster?.notifyRead(chatRoomId, userId);

  res.status(200).json({ success: true, message: "Messages marked as read", data: { updatedCount } });
});

/**
 * Soft delete message (current user)
 */
export const deleteMessage = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const result = await ChatService.softDeleteMessage({ messageId, userId });

  if (result) broadcaster?.notifyDeletedForAll(result.chatRoom.toString(), messageId);

  res.status(200).json({ success: true, message: "Message deleted successfully" });
});

/**
 * Hard delete message (sender or admin)
 */
export const deleteMessageForEveryone = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const user = req.user;

  const result = await ChatService.deleteMessageForEveryone({ user, messageId });

  broadcaster?.notifyDeletedForAll(result.chatRoom.toString(), messageId);

  res.status(200).json({ success: true, message: "Message deleted for everyone" });
});

/**
 * ===============================
 * AES KEY ROUTE (NEW)
 * ===============================
 */

/**
 * Get AES key for a chat room (E2EE)
 */
export const getAesKey = async (req, res) => {
    console.log("🔥 AES KEY ROUTE HIT", {
    userId: req.user?.id,
    chatRoomId: req.params.chatRoomId,
  });
  const { chatRoomId } = req.params;
  const userId = req.user.id;

  const { aesKey } = await ChatService.getAesKey({ chatRoomId, userId });

  res.status(200).json({
    success: true,
    data: {
      aesKey,
      encryptionVersion: 1,
    },
  });
};


