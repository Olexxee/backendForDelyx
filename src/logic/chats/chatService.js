import ChatRoom from "../../models/chatRoomSchema.js";
import Message from "../../models/messageSchema.js";
import { ensureChatAccess } from "./chatGuard.js";
import * as membershipService from "../../groupLogic/membershipService.js";
import { decrypt } from "../../lib/encryption.js";
import mongoose from "mongoose";
import {
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";
import notificationService from "../notifications/notificationService.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";

/**
 * =========================
 * ChatService
 * Handles encrypted messaging, message retrieval, delivery, and offline notifications.
 * =========================
 */
class ChatService {
  /**
   * Fetch latest messages
   */
  async getMessages({ chatRoomId, userId, limit = 30, before }) {
    const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
    if (!room) throw new NotFoundException("Chat room not found");
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
      // Include the encrypted fields so we can decrypt before sending
      .select(
        "_id chatRoom sender content encryptedContent iv authTag media createdAt",
      )
      .lean();

    const aesKey = room.aesKey;

    return {
      success: true,
      data: {
        messages: messages.map((msg) => {
          // Decrypt if we have the encrypted payload and the room key.
          // Fall back to stored plaintext content if decryption isn't possible.
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
              console.error(
                `Failed to decrypt message ${msg._id}:`,
                err.message,
              );
              plaintext = "";
            }
          }

          return {
            _id: msg._id.toString(),
            chatRoomId: msg.chatRoom.toString(),
            sender: msg.sender
              ? {
                  _id: msg.sender._id.toString(),
                  username: msg.sender.username,
                  profilePicture: msg.sender.profilePicture,
                }
              : null,
            content: plaintext,
            media: (msg.media || []).map((m) =>
              typeof m === "string" ? m : m.url,
            ),
            createdAt: msg.createdAt,
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
  async createMessage({ chatRoomId, senderId, content, mediaIds = [] }) {
    // 1️⃣ Validate input
    if ((!content || !content.trim()) && mediaIds.length === 0) {
      throw new BadRequestError("Message must have content or media");
    }

    if (!mongoose.Types.ObjectId.isValid(chatRoomId)) {
      throw new BadRequestError("Invalid chatRoomId");
    }

    // 2️⃣ Fetch chat room with AES key + participants
    const room = await ChatRoom.findById(chatRoomId).select(
      "+aesKey participants name",
    );
    if (!room) throw new NotFoundException("Chat room not found");

    // 3️⃣ Ensure sender has access
    await ensureChatAccess({ chatRoom: room, userId: senderId });

    const session = await mongoose.startSession();

    let messageDoc;

    await session.withTransaction(async () => {
      // 4️⃣ Create message (Message.create already saves it)
      const [message] = await Message.create(
        [
          {
            chatRoom: chatRoomId,
            sender: senderId,
            content: content?.trim() || null,
            media: mediaIds,
            deliveredTo: [senderId],
            readBy: [senderId],
          },
        ],
        { session },
      );

      messageDoc = message; // store for later use

      // 5️⃣ Update chat room with last message info
      await ChatRoom.updateOne(
        { _id: chatRoomId },
        {
          $set: {
            lastMessageId: message._id,
            lastMessageAt: message.createdAt,
            lastMessagePreview: content ?? "[Encrypted message]",
          },
        },
        { session },
      );
    });

    session.endSession();

    // 6️⃣ Populate sender details
    await messageDoc.populate(
      "sender",
      "username firstName lastName profilePicture",
    );

    console.log("Message created:", {
      id: messageDoc._id,
      content: messageDoc.content,
    });

    return messageDoc;
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
        $addToSet: { deliveredTo: userId },
        $set: { deliveredAt: new Date() },
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
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId }, $set: { readAt: new Date() } },
    );
  }

  /**
   * Soft delete a message
   */
  async softDeleteMessage({ messageId, userId }) {
    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundException("Message not found");

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
    if (!message) throw new NotFoundException("Message not found");

    if (!message.sender.equals(user.id)) {
      throw new ForbiddenError("Cannot delete someone else's message");
    }

    await message.remove();
    return message;
  }

  /**
   * Get AES encryption key
   */
  async getAesKey({ chatRoomId, userId }) {
    const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
    if (!room) throw new NotFoundException("Chat room not found");

    if (room.contextType === "group") {
      const membership = await membershipService.findMembership({
        userId,
        groupId: room.contextId,
      });
      if (!membership) throw new ForbiddenError("Not a member of this group");
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

    if (!offlineUsers.length) return;

    await Promise.all(
      offlineUsers.map((userId) =>
        notificationService.send({
          recipientId: userId,
          senderId,
          type: "CHAT_MESSAGE",
          title: room.name || "New Message",
          message: "You have a new encrypted message",
          payload: { chatRoomId },
        }),
      ),
    );
  }
}

// Export a single default instance
export default new ChatService();
