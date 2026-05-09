import mongoose from "mongoose";
import * as chatRoomService from "../../models/chatSchemaService.js";
import Message from "../../models/messageSchema.js";
import { decrypt } from "../../lib/encryption.js";
import { ensureChatAccess } from "./chatGuard.js";
import * as membershipService from "../../groupLogic/membershipService.js";

import { enqueueDomainEvent } from "../../queues/domainEventQueue.js";
import { EVENT_TYPES } from "../../event/eventTypes.js";

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
 * Build preview text for inbox + room surfaces
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
 * Resolve plaintext from encrypted payload
 */
const resolvePlaintext = ({ msg, aesKey }) => {
  let plaintext = msg.content || "";

  if (!plaintext && msg.encryptedContent && msg.iv && msg.authTag && aesKey) {
    try {
      plaintext = decrypt(msg.encryptedContent, aesKey, msg.iv, msg.authTag);
    } catch (err) {
      console.error(`Failed to decrypt message ${msg._id}:`, err.message);

      plaintext = "";
    }
  }

  return plaintext;
};

class ChatService {
  /**
   * Fetch room messages
   */
  async getMessages({ chatRoomId, userId, limit = 30, before }) {
    const room = await chatRoomService
      .getChatRoom(chatRoomId)
      .select("+aesKey");

    if (!room) {
      throw new NotFoundException("Chat room not found");
    }

    await ensureChatAccess({
      chatRoom: room,
      userId,
    });

    const messages = await Message.find({
      chatRoom: chatRoomId,
      deletedFor: { $ne: userId },
      isDeleted: { $ne: true },
      ...(before
        ? {
            createdAt: {
              $lt: new Date(before),
            },
          }
        : {}),
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
          const plaintext = resolvePlaintext({
            msg,
            aesKey,
          });

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
            kind: msg.messageType === "system" ? "system" : "user",
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
   * Create message
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

    const room = await chatRoomService
      .getChatRoom(chatRoomId)
      .select("+aesKey participants contextType contextId");

    if (!room) {
      throw new NotFoundException("Chat room not found");
    }

    await ensureChatAccess({
      chatRoom: room,
      userId: senderId,
    });

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

        await chatRoomService.updateChatRoom(
          chatRoomId,
          {
            lastMessageId: message._id,
            lastMessageAt: message.createdAt,
            lastMessagePreview: previewText,
          },
          { session },
        );
      });

      await messageDoc.populate(
        "sender",
        "username firstName lastName profilePicture",
      );

      /**
       * Emit domain event AFTER transaction commits
       */
      await enqueueDomainEvent(EVENT_TYPES.CHAT_MESSAGE_CREATED, {
        chatRoomId,
        messageId: messageDoc._id.toString(),
        senderId: senderId.toString(),
      });

      return messageDoc;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Mark messages as delivered
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
        $addToSet: {
          deliveredTo: userId,
        },

        $set: {
          deliveredAt: new Date(),
        },
      },
    );
  }

  /**
   * Mark messages as read
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
        $addToSet: {
          readBy: userId,
        },

        $set: {
          readAt: new Date(),
        },
      },
    );
  }

  /**
   * Soft delete message
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
   * Hard delete for everyone
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
   * Get AES room key
   */
  async getAesKey({ chatRoomId, userId }) {
    const room = await chatRoomService
      .getChatRoom(chatRoomId)
      .select("+aesKey contextType contextId");

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

    return {
      aesKey: room.aesKey,
    };
  }
}

export default new ChatService();
