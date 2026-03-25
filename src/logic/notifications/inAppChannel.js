import { getSocketsByUserId } from "../socket/socketRegistry.js";
import { io } from "../../server/serverConfig.js";
import logger from "../../lib/logger.js";

export const inAppChannel = {
  send: async ({ recipient, notification }) => {
    const sockets = getSocketsByUserId(recipient);

    if (!sockets || sockets.length === 0) {
      logger.info(`[InApp] User ${recipient} is offline, skipping in-app notification`);
      return { success: false, reason: "user_offline" };
    }

    sockets.forEach((socketId) => {
      io.to(socketId).emit("new_notification", notification);
    });

    logger.info(`[InApp] Sent notification to user ${recipient} via WebSocket`);
    return { success: true, recipient };
  },
};
