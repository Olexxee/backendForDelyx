import mongoose from "mongoose";
import ChatRoom from "../../models/chatRoomSchema.js";

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const sortObjectIds = (a, b) => a.toString().localeCompare(b.toString());

/**
 * Get or create a chat room for a group or direct conversation.
 *
 * For groups:
 * - one room per (contextType, contextId)
 *
 * For direct:
 * - one room per user pair
 *
 * @param {Object} params
 * @param {"group"|"direct"} params.contextType
 * @param {string|mongoose.Types.ObjectId} params.contextId
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string|mongoose.Types.ObjectId} [params.targetUserId] required for direct chats
 * @param {mongoose.ClientSession|null} [params.session]
 * @returns {Promise<Object>} ChatRoom document
 */
export const getOrCreateChatRoom = async ({
  contextType,
  contextId,
  userId,
  targetUserId = null,
  session = null,
}) => {
  if (!["group", "direct"].includes(contextType)) {
    throw new Error(`Invalid contextType: ${contextType}`);
  }

  if (contextType === "group") {
    try {
      let room = await ChatRoom.findOne(
        { contextType: "group", contextId },
        null,
        { session },
      );

      if (!room) {
        const [createdRoom] = await ChatRoom.create(
          [
            {
              contextType: "group",
              contextId,
              participants: [toObjectId(userId)],
              lastMessageAt: new Date(),
            },
          ],
          { session },
        );

        return createdRoom;
      }

      await ChatRoom.updateOne(
        { _id: room._id },
        { $addToSet: { participants: toObjectId(userId) } },
        { session },
      );

      return room;
    } catch (error) {
      if (error?.code === 11000) {
        return ChatRoom.findOne(
          { contextType: "group", contextId },
          null,
          { session },
        );
      }

      throw error;
    }
  }

  if (!targetUserId) {
    throw new Error("targetUserId is required for direct chat rooms");
  }

  const participantIds = [toObjectId(userId), toObjectId(targetUserId)].sort(
    sortObjectIds,
  );

  try {
    let room = await ChatRoom.findOne(
      {
        contextType: "direct",
        participants: { $all: participantIds, $size: 2 },
      },
      null,
      { session },
    );

    if (!room) {
      const [createdRoom] = await ChatRoom.create(
        [
          {
            contextType: "direct",
            contextId: participantIds[0],
            participants: participantIds,
            lastMessageAt: new Date(),
          },
        ],
        { session },
      );

      return createdRoom;
    }

    return room;
  } catch (error) {
    if (error?.code === 11000) {
      return ChatRoom.findOne(
        {
          contextType: "direct",
          participants: { $all: participantIds, $size: 2 },
        },
        null,
        { session },
      );
    }

    throw error;
  }
};