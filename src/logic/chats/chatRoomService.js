import mongoose from "mongoose";
import ChatRoom from "../../models/chatRoomSchema.js";
import { generateRoomKey } from "./chatRoomKeyService.js";

/**
 * Helper to convert to ObjectId
 */
const objectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Get an existing chat room or create a new one for a given context
 * @param {Object} params
 * @param {"group"|"direct"} params.contextType
 * @param {string} params.contextId
 * @param {string} params.userId
 * @returns {Promise<Object>} ChatRoom document
 */

export const getOrCreateChatRoom = async ({
  contextType,
  contextId,
  userId,
}) => {
  if (!["group", "direct"].includes(contextType)) {
    throw new Error(`Invalid contextType: ${contextType}`);
  }

  // Try to find an existing room
  let room = await ChatRoom.findOne({ contextType, contextId });

  if (room) {
    await ChatRoom.updateOne(
      { _id: room._id },
      { $addToSet: { participants: objectId(userId) } },
    );
    return room;
  }

  room = await ChatRoom.create({
    contextType,
    contextId,
    participants: [objectId(userId)],
    aesKey: generateRoomKey().toString("hex"),
    encryptionVersion: 1,
    lastMessageAt: new Date(),
  });

  return room;
};
