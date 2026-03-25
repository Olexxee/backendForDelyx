import logger from "../../lib/logger.js";
import * as notificationService from "./notificationService.js";
import { asyncWrapper } from "../../lib/utils.js"; // ✅ CORRECT

// ---------------------------------
// 📌 Get User Notifications
// ---------------------------------
export const getNotifications = asyncWrapper(async (req, res) => {
  const { unread } = req.query;

  const notifications = await notificationService.getUserNotifications(
    req.user.id,
    { unreadOnly: unread === "true" }
  );

  res.status(200).json({
    success: true,
    count: notifications.length,
    notifications,
  });
});

// ---------------------------------
// 📌 Mark Single Notification as Read
// ---------------------------------
export const markNotificationRead = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const notification = await notificationService.markNotificationRead(id);

  res.status(200).json({
    success: true,
    message: "Notification marked as read",
    notification,
  });
});

// ---------------------------------
// 📌 Mark All Notifications as Read
// ---------------------------------
export const markAllNotificationsRead = asyncWrapper(async (req, res) => {
  await notificationService.markAllNotificationsRead(req.user.id);

  res.status(200).json({
    success: true,
    message: "All notifications marked as read",
  });
});

// ---------------------------------
// 📌 Delete Notification
// ---------------------------------
export const deleteNotification = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  await notificationService.deleteNotification(id);

  res.status(200).json({
    success: true,
    message: "Notification deleted successfully",
  });
});
