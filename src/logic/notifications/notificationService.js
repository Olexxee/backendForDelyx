import logger from "../../lib/logger.js";
import * as notificationDb from "../../models/notificationSchemaService.js";
import { emailChannel } from "./emailChannel.js";
import { pushChannel } from "./pushChannel.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";
import { getIo } from "../socket/socketInstance.js";
import * as userService from "../../user/userService.js";

class NotificationService {
  /**
   * =========================
   * SEND NOTIFICATION
   * =========================
   */
  async send({
    recipientId,
    senderId = "system",
    type,
    title,
    message,
    channels = ["inApp", "push"],
    payload = {},
  }) {
    const activeChannels = [];

    const recipient = await userService.findUserById(recipientId);
    console.log("Recipient:", recipient);

    if (!recipient) {
      logger.error(`[Notification] Recipient ${recipientId} not found`);
      return { success: false };
    }

    // 1️⃣ In-app (WebSocket)
    if (channels.includes("inApp")) {
      const sockets = await getSocketsByUserId(recipientId);

      if (sockets.length > 0) {
        const io = getIo();
        sockets.forEach((socketId) => {
          io.to(socketId).emit("notification:new", {
            type,
            title,
            message,
            payload,
            senderId,
            createdAt: new Date(),
          });
        });
        activeChannels.push("inApp");
      }
    }

    if (channels.includes("push") && recipient.deviceTokens?.length) {
      try {
        await pushChannel.send({
          recipientToken: recipient.deviceTokens,
          title,
          message,
          meta: payload,
        });
        activeChannels.push("push");
      } catch (err) {
        logger.error(`[Notification] Push failed for ${recipientId}`, err);
      }
    }

    if (channels.includes("email") && recipient.email) {
      try {
        await emailChannel.send({
          to: recipient.email,
          type,
          payload,
        });
        activeChannels.push("email");
      } catch (err) {
        logger.error(`[Notification] Email failed for ${recipientId}`, err);
      }
    }

    // 4️⃣ Persist notification
    try {
      await notificationDb.createNotification({
        recipient: recipientId,
        sender: senderId,
        type,
        title,
        message,
        channels: activeChannels,
        meta: payload,
      });
    } catch (err) {
      logger.error("[Notification] DB persistence failed", err);
    }

    return {
      success: activeChannels.length > 0,
      channels: activeChannels,
    };
  }

  /**
   * =========================
   * READ / UPDATE
   * =========================
   */
  getForUser(userId, options = {}) {
    return notificationDb.findNotificationsByRecipient(userId, options);
  }

  markAsRead(notificationId) {
    return notificationDb.markNotificationRead(notificationId);
  }

  markAllAsRead(userId) {
    return notificationDb.markAllNotificationsRead(userId);
  }

  delete(notificationId) {
    return notificationDb.deleteNotificationById(notificationId);
  }
}

export default new NotificationService();