import logger from "../lib/logger.js";
// models/notificationSchemaService.js
import Notification from "./notificationShema.js";
import { NotificationTypes } from "../logic/notifications/notificationTypes.js";

/**
 * Create a new notification
 */
export const createNotification = async ({
  recipient,
  sender = null,
  type,
  title,
  message,
  meta = {},
}) => {
  return Notification.create({
    recipient,
    sender,
    type,
    title,
    message,
    meta,
  });
};

/**
 * Find notifications for a recipient
 */
export const findNotificationsByRecipient = async (
  recipientId,
  { unreadOnly = false } = {}
) => {
  const query = { recipient: recipientId };
  if (unreadOnly) query.read = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .populate("recipient", "firstName lastName displayName email")
    .lean();

  // Manually populate sender profile if sender.item exists
  for (const notif of notifications) {
    if (notif.sender?.item) {
      const Profile = (await import("./profileSchema.js")).default;
      const senderProfile = await Profile.findOne({ user: notif.sender.item })
        .select("displayName firstName lastName profilePicture")
        .lean();
      
      if (senderProfile) {
        notif.sender = {
          ...notif.sender,
          profile: senderProfile
        };
      }
    }
  }

  return notifications;
};

/**
 * Get single notification by id
 */
export const findNotificationById = async (id) => {
  return Notification.findById(id).populate("sender").populate("recipient");
};

/**
 * Mark one notification as read
 */
export const markNotificationRead = async (id) => {
  return Notification.findByIdAndUpdate(id, { read: true }, { new: true });
};

/**
 * Mark all notifications as read for a recipient
 */
export const markAllNotificationsRead = async (recipientId) => {
  return Notification.updateMany(
    { recipient: recipientId, read: false },
    { read: true }
  );
};

/**
 * Delete one notification
 */
export const deleteNotificationById = async (id) => {
  return Notification.findByIdAndDelete(id);
};

/**
 * Delete all notifications for a user
 */
export const deleteAllNotificationsForUser = async (recipientId) => {
  return Notification.deleteMany({ recipient: recipientId });
};

// ✅ Export full NotificationTypes (imported from constants)
export { NotificationTypes };
