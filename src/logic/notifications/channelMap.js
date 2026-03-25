import { NotificationTypes } from "./notificationTypes.js";

export const channelMap = {
  // Engagement
  [NotificationTypes.WELCOME_EMAIL]: ["email"],
  [NotificationTypes.PROFILE_REMINDER]: ["email", "push"],
  [NotificationTypes.NEW_CONNECTION_REQUEST]: ["inApp", "push"],
  [NotificationTypes.CONNECTION_ACCEPTED]: ["inApp", "push"],
  [NotificationTypes.EVENT_REMINDER]: ["inApp", "push", "email"],
  [NotificationTypes.NEW_EVENT]: ["inApp", "push"],
  [NotificationTypes.NEW_ITEM]: ["inApp", "push"],
  [NotificationTypes.WEEKLY_DIGEST]: ["email"],
  [NotificationTypes.INACTIVE_USER]: ["email", "push"],
  [NotificationTypes.PREMIUM_UPGRADE]: ["email", "push"],

  // Buddy
  [NotificationTypes.CONNECTION_REQUEST]: ["inApp", "push"],
  [NotificationTypes.CONNECTION_ACCEPTED]: ["inApp", "push"],
  [NotificationTypes.USER_BLOCKED]: ["inApp"],
  [NotificationTypes.USER_UNBLOCKED]: ["inApp"],
  [NotificationTypes.CONNECTION_REMOVED]: ["inApp"],

  // Events
  [NotificationTypes.EVENT_RSVP_CONFIRMED]: ["inApp", "push", "email"],
  [NotificationTypes.NEW_EVENT_RSVP]: ["inApp", "push"],
  [NotificationTypes.EVENT_TICKET_CONFIRMED]: ["email", "push"],
  [NotificationTypes.NEW_EVENT_TICKET]: ["inApp", "push"],
  [NotificationTypes.EVENT_RSVP_CANCELLED]: ["inApp", "push", "email"],

  // Store
  [NotificationTypes.STORE_CREATED]: ["inApp", "push"],
  [NotificationTypes.STORE_UPDATED]: ["inApp", "push"],
  [NotificationTypes.STORE_DEACTIVATED]: ["inApp", "push"],
  [NotificationTypes.STORE_REACTIVATED]: ["inApp", "push"],
  [NotificationTypes.STORE_DELETED]: ["inApp", "push", "email"],

  // Upgrades
  [NotificationTypes.UPGRADE_PROMPT]: ["email"],
  [NotificationTypes.FEATURE_UPGRADE_PROMPT]: ["email", "push"],
  [NotificationTypes.SUCCESS_UPGRADE_PROMPT]: ["email"],

  // Ask module
  [NotificationTypes.ASK_CREATED]: ["inApp", "push", "email"],
  [NotificationTypes.ASK_HELPFUL_MARKED]: ["inApp", "push"],
  [NotificationTypes.ASK_FAVORITED]: ["inApp"],
  [NotificationTypes.ASK_COMMENT_ADDED]: ["inApp", "push"],
  [NotificationTypes.ASK_COMMENT_REPLY]: ["inApp", "push"],
  [NotificationTypes.ASK_MENTION]: ["inApp", "push", "email"],

  // Bump module
  [NotificationTypes.BUMP_CREATED]: ["inApp", "push"],
  [NotificationTypes.BUMP_ACTIVATED]: ["inApp", "push", "email"],
  [NotificationTypes.BUMP_EXPIRED]: ["inApp", "push"],
  [NotificationTypes.BUMP_ANALYTICS_REPORT]: ["email"],

  // Channel map
  [NotificationTypes.MATCH_CREATED]: ["inApp", "push"],
  [NotificationTypes.MATCH_FOUND]: ["inApp", "push", "email"],
  [NotificationTypes.MATCH_BLOCKED]: ["inApp", "push"],

  // Profile
  [NotificationTypes.PROFILE_CREATED]: ["email"],
  [NotificationTypes.PROFILE_UPDATED]: ["push", "inApp"],
  [NotificationTypes.PROFILE_PICTURE_UPDATED]: ["push", "inApp"],
  [NotificationTypes.PROFILE_VISIBILITY_CHANGED]: ["push"],
  [NotificationTypes.PROFILE_GALLERY_UPDATED]: ["inApp"],

  // Users
  [NotificationTypes.USER_REGISTERED]: ["EMAIL", "APP"],
  [NotificationTypes.USER_SOCIAL_REGISTERED]: ["EMAIL", "APP"],

  [NotificationTypes.VERIFICATION_SENT]: ["EMAIL", "APP"],
  [NotificationTypes.USER_VERIFIED]: ["EMAIL", "APP"],

  [NotificationTypes.PASSWORD_CHANGED]: ["EMAIL", "APP"],
  [NotificationTypes.PASSWORD_RESET_REQUESTED]: ["EMAIL", "APP"],
  [NotificationTypes.PASSWORD_RESET_SUCCESS]: ["EMAIL", "APP"],

  [NotificationTypes.PROFILE_PICTURE_UPDATED]: ["APP"],
  [NotificationTypes.ACCOUNT_DELETED]: ["EMAIL", "APP"],

  // ---- Account lifecycle / Outboarding ----
  [NotificationTypes.ACCOUNT_PAUSED]: ["email", "inApp"],

  [NotificationTypes.ACCOUNT_REACTIVATED]: ["email", "inApp"],

  [NotificationTypes.ACCOUNT_DELETION_REQUESTED]: ["email", "inApp"],

  [NotificationTypes.ACCOUNT_PERMANENTLY_DELETED]: ["email"],
};
