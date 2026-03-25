import logger from "../../lib/logger.js";
import { firebaseMessaging } from "../../config/firebaseAdmin.js";

export const pushChannel = {
  send: async ({ recipientToken, title, message, meta = {} }) => {
    if (!recipientToken) return;

    const payload = {
      notification: {
        title,
        body: message,
      },
      data: {
        ...meta, // custom data for your app
      },
      android: {
        priority: "high",
        notification: {
          sound: "default", // or a custom sound bundled in the app
          channelId: process.env.FCM_ANDROID_CHANNEL || "default_channel",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body: message,
            },
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    if (Array.isArray(recipientToken)) {
      return firebaseMessaging.sendEachForMulticast({
        tokens: recipientToken,
        ...payload,
      });
    }

    return firebaseMessaging.send({
      ...payload,
      token: recipientToken,
    });
  },
};
