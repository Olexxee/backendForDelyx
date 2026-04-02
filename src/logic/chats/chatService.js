import mongoose from "mongoose";
import ChatRoom from "../../models/chatRoomSchema.js";
import Message from "../../models/messageSchema.js";
import { decrypt } from "../../lib/encryption.js";
import { ensureChatAccess } from "./chatGuard.js";
import * as membershipService from "../../groupLogic/membershipService.js";
import notificationService from "../notifications/notificationService.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";
import {
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";

/**
 * Resolve message type from content/media/system flag
 */
const resolveMessageType = ({ content, mediaIds = [], system = false }) => {
  if (system) return "system";

  const hasText = Boolean(content && content.trim());
  const hasMedia = Array.isArray(mediaIds) && mediaIds.length > 0;

  if (hasText && hasMedia) return "mixed";
  if (hasMedia) return "media";
  return "text";
};

/**
 * Build preview text for chat room + inbox surfaces
 */
const buildPreviewText = ({ content, mediaIds = [], messageType }) => {
  const trimmed = content?.trim() || "";
  const mediaCount = Array.isArray(mediaIds) ? mediaIds.length : 0;

  if (messageType === "system") {
    return trimmed || "System update";
  }

  if (messageType === "media") {
    return mediaCount > 1 ? `📎 ${mediaCount} attachments` : "📎 Attachment";
  }

  if (messageType === "mixed") {
    const clipped = trimmed.slice(0, 80);
    return mediaCount > 0
      ? `${clipped} · ${mediaCount} attachment${mediaCount > 1 ? "s" : ""}`
      : clipped;
  }

  return trimmed.slice(0, 120);
};

/**
 * Decrypt a message payload into plaintext
 */
const resolvePlaintext = ({ msg, aesKey }) => {
  let plaintext = msg.content || "";

  if (
    !plaintext &&
    msg.encryptedContent &&
    msg.iv &&
    msg.authTag &&
    aesKey
  ) {
    try {
      plaintext = decrypt(
        msg.encryptedContent,
        aesKey,
        msg.iv,
        msg.authTag,
      );
    } catch (err) {
      console.error(`Failed to decrypt message ${msg._id}:`, err.message);
      plaintext = "";
    }
  }

  return plaintext;
};

class ChatService {
  /**
   * Fetch latest messages
   */
  async getMessages({ chatRoomId, userId, limit = 30, before }) {
    const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
    if (!room) {
      throw new NotFoundException("Chat room not found");
    }

    await ensureChatAccess({ chatRoom: room, userId });

    const messages = await Message.find({
      chatRoom: chatRoomId,
      deletedFor: { $ne: userId },
      isDeleted: { $ne: true },
      ...(before ? { createdAt: { $lt: new Date(before) } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "username profilePicture")
      .select(
        [
          "_id",
          "chatRoom",
          "sender",
          "content",
          "encryptedContent",
          "iv",
          "authTag",
          "media",
          "messageType",
          "meta",
          "previewText",
          "createdAt",
        ].join(" "),
      )
      .lean();

    const aesKey = room.aesKey;

    return {
      success: true,
      data: {
        messages: messages.map((msg) => {
          const plaintext = resolvePlaintext({ msg, aesKey });

          return {
            id: msg._id.toString(),
            chatRoomId: msg.chatRoom.toString(),
            sender: msg.sender
              ? {
                  id: msg.sender._id.toString(),
                  username: msg.sender.username,
                  profilePicture: msg.sender.profilePicture ?? null,
                }
              : null,
            content: plaintext,
            media: (msg.media || []).map((m) =>
              typeof m === "string" ? m : m.url,
            ),
            messageType: msg.messageType || "text",
            meta: msg.meta ?? null,
            createdAt: msg.createdAt,
            isMine: msg.sender?._id?.toString() === userId.toString(),
          };
        }),
        count: messages.length,
        hasMore: messages.length === limit,
      },
    };
  }

  /**
   * Create a new message
   */
  async createMessage({
    chatRoomId,
    senderId,
    content,
    mediaIds = [],
    meta = null,
    system = false,
  }) {
    const trimmedContent = content?.trim() || "";

    if (!trimmedContent && mediaIds.length === 0) {
      throw new BadRequestError("Message must have content or media");
    }

    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new BadRequestError("Invalid chatRoomId");
    }

    const room = await ChatRoom.findById(chatRoomId).select(
      "+aesKey participants contextType contextId",
    );

    if (!room) {
      throw new NotFoundException("Chat room not found");
    }

    await ensureChatAccess({ chatRoom: room, userId: senderId });

    const messageType = resolveMessageType({
      content: trimmedContent,
      mediaIds,
      system,
    });

    const previewText = buildPreviewText({
      content: trimmedContent,
      mediaIds,
      messageType,
    });

    const session = await mongoose.startSession();
    let messageDoc;

    try {
      await session.withTransaction(async () => {
        const [message] = await Message.create(
          [
            {
              chatRoom: chatRoomId,
              sender: senderId,
              messageType,
              content: trimmedContent || null,
              media: mediaIds,
              previewText,
              meta,
              deliveredTo: [senderId],
              readBy: [senderId],
              deliveredAt: new Date(),
              readAt: new Date(),
            },
          ],
          { session },
        );

        messageDoc = message;

        await ChatRoom.updateOne(
          { _id: chatRoomId },
          {
            $set: {
              lastMessageId: message._id,
              lastMessageAt: message.createdAt,
              lastMessagePreview: previewText,
            },
          },
          { session },
        );
      });

      await messageDoc.populate(
        "sender",
        "username firstName lastName profilePicture",
      );

      return messageDoc;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark room messages as delivered for a user
   */
  async markDelivered({ chatRoomId, userId }) {
    await Message.updateMany(
      {
        chatRoom: chatRoomId,
        isDeleted: { $ne: true },
        deletedFor: { $ne: userId },
        deliveredTo: { $ne: userId },
      },
      {
        $addToSet: { deliveredTo: userId },
        $set: { deliveredAt: new Date() },
      },
    );
  }

  /**
   * Mark room messages as read for a user
   */
  async markRead({ chatRoomId, userId }) {
    await Message.updateMany(
      {
        chatRoom: chatRoomId,
        isDeleted: { $ne: true },
        deletedFor: { $ne: userId },
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
        $set: { readAt: new Date() },
      },
    );
  }

  /**
   * Soft delete a message
   */
  async softDeleteMessage({ messageId, userId }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (!message.sender.equals(userId)) {
      throw new ForbiddenError("Cannot delete someone else's message");
    }

    message.isDeleted = true;
    await message.save();

    return message;
  }

  /**
   * Hard delete a message for everyone
   */
  async deleteMessageForEveryone({ user, messageId }) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (!message.sender.equals(user.id)) {
      throw new ForbiddenError("Cannot delete someone else's message");
    }

    await message.deleteOne();
    return message;
  }

  /**
   * Get AES encryption key for a room
   */
  async getAesKey({ chatRoomId, userId }) {
    const room = await ChatRoom.findById(chatRoomId).select(
      "+aesKey contextType contextId",
    );

    if (!room) {
      throw new NotFoundException("Chat room not found");
    }

    if (room.contextType === "group") {
      const membership = await membershipService.findMembership({
        userId,
        groupId: room.contextId,
      });

      if (!membership) {
        throw new ForbiddenError("Not a member of this group");
      }
    }

    return { aesKey: room.aesKey };
  }

  /**
   * Notify offline participants
   */
  async notifyOfflineParticipants(room, senderId, chatRoomId) {
    const offlineUsers = room.participants
      .map(String)
      .filter(
        (id) =>
          id !== senderId.toString() && getSocketsByUserId(id).length === 0,
      );

    if (!offlineUsers.length) {
      return;
    }

    await Promise.all(
      offlineUsers.map((userId) =>
        notificationService.send({
          recipientId: userId,
          senderId,
          type: "CHAT_MESSAGE",
          title: "New Message",
          message: "You have a new encrypted message",
          payload: { chatRoomId },
        }),
      ),
    );
  }
}

export default new ChatService();