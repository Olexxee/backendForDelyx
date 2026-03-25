import logger from "../../lib/logger.js";
import { firebaseMessaging } from "../../config/firebaseAdmin.js";

export const pushChannel = {
  send: async ({ recipientToken, title, message, meta = {} }) => {
    if (!recipientToken) {
      throw new Error("Missing push token");
    }

    const tokens = Array.isArray(recipientToken)
      ? recipientToken
      : [recipientToken];

    const payload = {
      data: {
        title,
        body: message,
        type: meta.type || "general",
        ...Object.fromEntries(
          Object.entries(meta).map(([k, v]) => [k, String(v)])
        ),
      },
    };

    const response = await firebaseMessaging.sendEachForMulticast({
      tokens,
      ...payload,
    });

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        logger.warn("Push failed:", {
          token: tokens[idx],
          error: res.error?.code,
        });
      }
    });

    return response;
  },
};
