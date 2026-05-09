import * as chatRoomDb from "../../models/chatSchemaService.js";
import * as userService from "../../user/userService.js";
import { enqueueNotificationJob } from "../../queues/notificationQueue.js";
import { getSocketsByUserId } from "../../logic/socket/socketRegistry.js";

export const handleChatMessageCreated = async ({
  chatRoomId,
  messageId,
  senderId,
}) => {
  const room = await chatRoomDb.findChatById(chatRoomId).lean();
  if (!room) return;

  const sender = await userService.findUserById(senderId);
  if (!sender) return;

  const recipientIds = room.participants
    .map((id) => id.toString())
    .filter((id) => id !== senderId.toString());

  const offlineRecipientIds = recipientIds.filter(
    (id) => getSocketsByUserId(id).length === 0,
  );

  await Promise.all(
    offlineRecipientIds.map((recipientId) =>
      enqueueNotificationJob("CHAT_MESSAGE_NOTIFICATION", {
        recipientId,
        senderId,
        chatRoomId,
        messageId,
        senderUsername: sender.username,
      }),
    ),
  );
};
