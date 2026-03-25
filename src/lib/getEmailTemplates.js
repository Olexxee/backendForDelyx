import {
  welcomeEmailTemplate,
  profileReminderTemplate,
  newConnectionRequestTemplate,
  connectionAcceptedTemplate,
  eventReminderTemplate,
  newEventTemplate,
  newItemTemplate,
  weeklyDigestTemplate,
  inactiveUserTemplate,
  premiumUpgradeTemplate,
  passwordChangedTemplate,
  passwordResetRequestedTemplate,
  passwordResetSuccessTemplate,
  accountDeletedTemplate,
  accountPermanentlyRemovedTemplate,
  accountReactivatedTemplate,
} from "../logic/notifications/emailTemplates.js";

import { NotificationTypes } from "../logic/notifications/notificationTypes.js";

export const getEmailTemplate = (type, payload = {}) => {
  switch (type) {
    case NotificationTypes.WELCOME_EMAIL:
      return welcomeEmailTemplate(payload.firstName, payload.profileLink);

    case NotificationTypes.PROFILE_REMINDER:
      return profileReminderTemplate(payload.firstName, payload.profileLink);

    case NotificationTypes.NEW_CONNECTION_REQUEST:
      return newConnectionRequestTemplate(
        payload.firstName,
        payload.requesterName
      );

    case NotificationTypes.CONNECTION_ACCEPTED:
      return connectionAcceptedTemplate(
        payload.firstName,
        payload.accepterName
      );

    case NotificationTypes.EVENT_REMINDER:
      return eventReminderTemplate(
        payload.firstName,
        payload.eventTitle,
        payload.eventDate
      );

    case NotificationTypes.NEW_EVENT:
      return newEventTemplate(
        payload.firstName,
        payload.eventTitle,
        payload.eventLink
      );

    case NotificationTypes.NEW_ITEM:
      return newItemTemplate(
        payload.firstName,
        payload.itemName,
        payload.itemLink
      );

    case NotificationTypes.WEEKLY_DIGEST:
      return weeklyDigestTemplate(payload.firstName);

    case NotificationTypes.INACTIVE_USER:
      return inactiveUserTemplate(payload.firstName);

    case NotificationTypes.PREMIUM_UPGRADE:
      return premiumUpgradeTemplate(payload.firstName, payload.planName);

    case NotificationTypes.PASSWORD_CHANGED:
      return passwordChangedTemplate(payload.firstName);

    case NotificationTypes.PASSWORD_RESET_REQUESTED:
      return passwordResetRequestedTemplate(
        payload.firstName,
        payload.resetLink
      );

    case NotificationTypes.PASSWORD_RESET_SUCCESS:
      return passwordResetSuccessTemplate(payload.firstName);

    case NotificationTypes.ACCOUNT_DELETION_REQUESTED:
      return accountDeletedTemplate(payload.firstName);

    case NotificationTypes.ACCOUNT_PERMANENTLY_DELETED:
      return accountPermanentlyRemovedTemplate(payload.firstName);

    case NotificationTypes.ACCOUNT_REACTIVATED:
      return accountReactivatedTemplate(payload.firstName);

    default:
      return {
        subject: "Notification from Jami",
        body: "You have a new notification.",
      };
  }
};
