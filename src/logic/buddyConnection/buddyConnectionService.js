import logger from "../../lib/logger.js";
import * as buddyConnectionDb from "../../models/buddyConnectionSchemaService.js";
import * as errorService from "../../lib/classes/errorClasses.js";
import * as chatRoomService from "../../models/chatSchemaService.js";
import * as userDb from "../../user/userService.js";
import * as notificationService from "../../models/notificationSchemaService.js";
import { NotificationTypes } from "../../logic/notifications/notificationTypes.js";

// Send buddy request
export const sendBuddyRequest = async (
  requesterId,
  recipientId,
  expiresAt = null
) => {
  if (!requesterId || !recipientId) {
    throw new errorService.BadRequestError(
      "Requester or recipient ID is missing"
    );
  }
  if (requesterId.toString() === recipientId.toString()) {
    throw new errorService.BadRequestError(
      "You cannot send a buddy request to yourself"
    );
  }

  const existing = await buddyConnectionDb.findConnection({
    $or: [
      { requester: requesterId, recipient: recipientId },
      { requester: recipientId, recipient: requesterId },
    ],
  });

  if (existing) {
    if (existing.status === "pending")
      throw new errorService.BadRequestError("Buddy request already pending");
    if (existing.status === "accepted")
      throw new errorService.BadRequestError("You are already buddies");
    if (existing.status === "blocked")
      throw new errorService.BadRequestError(
        "Cannot send request to blocked user"
      );
  }

  const connection = await buddyConnectionDb.createConnection({
    requester: requesterId,
    recipient: recipientId,
    status: "pending",
    expiresAt,
  });

  // Send notification to recipient
  await notificationService.create({
    recipient: recipientId,
    sender: requesterId,
    type: NotificationTypes.CONNECTION_REQUEST,
    title: "New Buddy Request",
    message: "You have a new buddy request",
    meta: { connectionId: connection._id },
  });

  return connection;
};

// Accept connection
export const acceptConnection = async (connectionId, userId) => {
  const connection = await buddyConnectionDb.findConnectionById(connectionId);
  if (!connection)
    throw new errorService.NotFoundException("Connection not found");

  if (!connection.recipient.equals(userId)) {
    throw new errorService.UnauthorizedException(
      "Not authorized to accept this request"
    );
  }

  connection.status = "accepted";
  connection.matchedAt = new Date();
  await connection.save();

  let chatRoom = await chatRoomService.findChatByContext(
    "Buddy",
    connection._id
  );
  if (!chatRoom) {
    chatRoom = await chatRoomService.createChatRoom({
      participants: [connection.requester, connection.recipient],
      contextType: "Buddy",
      contextId: connection._id,
    });
  }

  // Notify the requester
  await notificationService.create({
    recipient: connection.requester,
    sender: userId,
    type: NotificationTypes.CONNECTION_ACCEPTED,
    title: "Buddy Request Accepted",
    message: "Your buddy request has been accepted",
    meta: { connectionId: connection._id },
  });

  return { connection, chatRoom };
};

// Block buddy user
export const blockBuddyUser = async (userId, targetUserId) => {
  let connection = await buddyConnectionDb.findConnection({
    $or: [
      { requester: userId, recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!connection) {
    connection = await buddyConnectionDb.createConnection({
      requester: userId,
      recipient: targetUserId,
      status: "blocked",
    });
  } else {
    connection.status = "blocked";
    await connection.save();
  }

  await userDb.addBlockedUser(userId, targetUserId);

  // Optional: notify the blocked user
  await notificationService.create({
    recipient: targetUserId,
    sender: userId,
    type: NotificationTypes.USER_BLOCKED,
    title: "You have been blocked",
    message: "This user has blocked you",
    meta: { blockerId: userId },
  });

  return connection;
};

// Unblock buddy user
export const unblockBuddyUser = async (userId, targetUserId) => {
  const connection = await buddyConnectionDb.findConnection({
    $or: [
      { requester: userId, recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!connection || connection.status !== "blocked") {
    throw new errorService.BadRequestError("No blocked connection found");
  }

  connection.status = "none"; // Reset connection
  await connection.save();

  await userDb.removeBlockedUser(userId, targetUserId);

  // Optional: notify the user
  await notificationService.create({
    recipient: targetUserId,
    sender: userId,
    type: NotificationTypes.USER_UNBLOCKED,
    title: "You have been unblocked",
    message: "This user has unblocked you",
    meta: { unblockerId: userId },
  });

  return { message: "User has been unblocked" };
};

// Remove buddy connection
export const removeConnection = async (userId, targetUserId) => {
  const deleted = await buddyConnectionDb.deleteConnection({
    $or: [
      { requester: userId, recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!deleted) {
    return { success: false, message: "No connection found to delete" };
  }

  // Notify the other user
  await notificationService.create({
    recipient: targetUserId,
    sender: userId,
    type: NotificationTypes.CONNECTION_REMOVED,
    title: "Buddy Connection Removed",
    message: "This user has removed you from their buddy list",
    meta: { connectionId: deleted._id },
  });

  return {
    success: true,
    message: "Buddy connection has been deleted successfully",
    deletedConnection: deleted,
  };
};

// List buddy connections
export const listBuddyConnections = async (
  userId,
  status = "accepted",
  options = {}
) => {
  return buddyConnectionDb.findConnections(
    {
      $or: [{ requester: userId }, { recipient: userId }],
      status,
    },
    options
  );
};

// Get connection details
export const getConnectionDetails = async (requesterId, recipientId) => {
  const connection = await buddyConnectionDb.findConnection({
    requester: requesterId,
    recipient: recipientId,
  });

  if (!connection)
    throw new errorService.NotFoundException("Connection not found");
  return connection;
};
