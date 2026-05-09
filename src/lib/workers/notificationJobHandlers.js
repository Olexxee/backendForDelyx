import NotificationService from "../../logic/notifications/notificationService.js";
import * as userService from "../../user/userService.js";
import * as groupDb from "../../groupLogic/gSchemaService.js";
import * as membershipDb from "../../groupLogic/membershipSchemaService.js";
import { getEmailTemplate } from "../../logic/notifications/emailTemplates.js";
import { NotificationTypes } from "../../logic/notifications/notificationTypes.js";

// ─── Auth / Account ───────────────────────────────────────────────────────────

export const handleUserRegistered = async ({ userId }) => {
  const user = await userService.findUserById(userId);
  if (!user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: NotificationTypes.USER_REGISTERED,
    title: "Welcome to Delyx 🎮",
    message: `Hi ${user.username}, welcome to Delyx! Your gaming community awaits.`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      html: getEmailTemplate("WELCOME_EMAIL", {
        username: user.username,
        profileLink: "Coming soon...",
      }),
    },
  });
};

export const handleVerificationSent = async ({ userId, verificationCode }) => {
  const user = await userService.findUserById(userId);
  if (!user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: NotificationTypes.VERIFICATION_SENT,
    title: "Verify your email 🔑",
    message: `Use code ${verificationCode} to verify your email.`,
    channels: ["email"],
    payload: {
      email: user.email,
      html: getEmailTemplate("OTP_EMAIL", {
        username: user.username,
        code: verificationCode,
      }),
    },
  });
};

export const handlePasswordChanged = async ({ userId }) => {
  const user = await userService.findUserById(userId);
  if (!user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: NotificationTypes.PASSWORD_CHANGED,
    title: "Password Changed 🔐",
    message: "Your password has been successfully updated.",
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      html: getEmailTemplate("PASSWORD_CHANGED", {
        username: user.username,
      }),
    },
  });
};

export const handlePasswordResetRequested = async ({ userId, resetLink }) => {
  const user = await userService.findUserById(userId);
  if (!user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: NotificationTypes.PASSWORD_RESET_REQUESTED,
    title: "Password Reset Request 🔑",
    message: "You requested a password reset.",
    channels: ["email"],
    payload: {
      email: user.email,
      html: getEmailTemplate("PASSWORD_RESET_REQUESTED", {
        username: user.username,
        resetLink,
      }),
    },
  });
};

export const handlePasswordResetSuccess = async ({ userId }) => {
  const user = await userService.findUserById(userId);
  if (!user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: NotificationTypes.PASSWORD_RESET_SUCCESS,
    title: "Password Reset Successful 🎉",
    message: "You can now log in with your new password.",
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      html: getEmailTemplate("PASSWORD_RESET_SUCCESS", {
        username: user.username,
      }),
    },
  });
};

// ─── Group ────────────────────────────────────────────────────────────────────

export const handleGroupCreated = async ({ userId, groupId }) => {
  const [user, group] = await Promise.all([
    userService.findUserById(userId),
    groupDb.findGroupById(groupId),
  ]);

  if (!user || !group) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: "GROUP_CREATED",
    title: `Group "${group.name}" created 🎉`,
    message: `You are now the admin of "${group.name}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
    },
  });
};

export const handleGroupJoinRequested = async ({
  groupId,
  requesterUserId,
}) => {
  const [group, requester, memberships] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(requesterUserId),
    membershipDb.findMembersByGroupId(
      { groupId, status: "active" },
      { limit: 200 },
    ),
  ]);

  if (!group || !requester) return;

  const adminMemberships = memberships.filter(
    (membership) => membership.roleInGroup === "admin",
  );

  await Promise.all(
    adminMemberships.map(async (membership) => {
      const admin = await userService.findUserById(membership.userId);
      if (!admin) return;

      await NotificationService.send({
        recipientId: admin._id,
        senderId: "system",
        type: "GROUP_JOIN_REQUESTED",
        title: `New join request for "${group.name}"`,
        message: `${requester.username} requested to join "${group.name}".`,
        channels: ["inApp", "email"],
        payload: {
          email: admin.email,
          groupId: group._id.toString(),
          groupName: group.name,
          requesterUserId: requester._id.toString(),
          requesterUsername: requester.username,
        },
      });
    }),
  );
};

export const handleGroupJoinRequestApproved = async ({
  groupId,
  targetUserId,
  adminId,
}) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id ?? "system",
    type: "GROUP_JOIN_REQUEST_APPROVED",
    title: `You joined "${group.name}" ✅`,
    message: `Your request to join "${group.name}" was approved.`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
      adminUsername: admin?.username ?? "Admin",
    },
  });
};

export const handleGroupJoinRequestRejected = async ({
  groupId,
  targetUserId,
  adminId,
}) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id ?? "system",
    type: "GROUP_JOIN_REQUEST_REJECTED",
    title: "Join request declined",
    message: `Your request to join "${group.name}" was declined.`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
      adminUsername: admin?.username ?? "Admin",
    },
  });
};

export const handleGroupMemberJoined = async ({ groupId, userId, via }) => {
  const [group, user] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(userId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: "GROUP_MEMBER_JOINED",
    title: `You joined "${group.name}"`,
    message:
      via === "invite"
        ? `You joined "${group.name}" via invite link.`
        : `You successfully joined "${group.name}".`,
    channels: ["inApp"],
    payload: {
      groupId: group._id.toString(),
      groupName: group.name,
    },
  });
};

export const handleGroupMemberLeft = async ({ groupId, userId }) => {
  const [group, user] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(userId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: "system",
    type: "GROUP_MEMBER_LEFT",
    title: `You left "${group.name}"`,
    message: `You are no longer a member of "${group.name}".`,
    channels: ["inApp"],
    payload: {
      groupId: group._id.toString(),
      groupName: group.name,
    },
  });
};

export const handleGroupMemberKicked = async ({
  groupId,
  targetUserId,
  adminId,
}) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id ?? "system",
    type: "GROUP_MEMBER_KICKED",
    title: `Removed from "${group.name}"`,
    message: `You were removed from "${group.name}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
      adminUsername: admin?.username ?? "Admin",
    },
  });
};

export const handleGroupMemberBanned = async ({
  groupId,
  targetUserId,
  adminId,
}) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id ?? "system",
    type: "GROUP_MEMBER_BANNED",
    title: `Banned from "${group.name}"`,
    message: `You were banned from "${group.name}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
      adminUsername: admin?.username ?? "Admin",
    },
  });
};

export const handleGroupRoleChanged = async ({
  groupId,
  targetUserId,
  adminId,
  newRole,
}) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id ?? "system",
    type: "GROUP_ROLE_CHANGED",
    title: `Role updated in "${group.name}"`,
    message: `Your role in "${group.name}" is now "${newRole}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
      adminUsername: admin?.username ?? "Admin",
      newRole,
    },
  });
};

// ─── Feed: Comments ───────────────────────────────────────────────────────────

/**
 * "feed.notify.comment"
 *
 * Fired when someone comments on a post or replies to a comment.
 * The author self-comment guard is already applied in feedEventHandlers.js
 * before this job is enqueued, so no repeat check is needed here.
 *
 * data: {
 *   recipientId:     string  — post/comment author
 *   actorId:         string  — person who commented
 *   targetType:      "post"
 *   targetId:        string  — the post that was commented on
 *   commentId:       string
 *   isReply:         boolean
 * }
 */
export const handleFeedNotifyComment = async ({
  recipientId,
  actorId,
  targetId,
  commentId,
  isReply,
}) => {
  const [recipient, actor] = await Promise.all([
    userService.findUserById(recipientId),
    userService.findUserById(actorId),
  ]);

  if (!recipient || !actor) return;

  const title = isReply ? "New reply 💬" : "New comment 💬";
  const message = isReply
    ? `${actor.username} replied to your comment.`
    : `${actor.username} commented on your post.`;

  await NotificationService.send({
    recipientId: recipient._id,
    senderId: actor._id,
    type: isReply ? "FEED_COMMENT_REPLY" : "FEED_POST_COMMENT",
    title,
    message,
    channels: ["inApp"],
    payload: {
      targetType: "post",
      targetId,
      commentId,
      actorUsername: actor.username,
      actorAvatar: actor.profilePicture ?? null,
    },
  });
};

// ─── Feed: Reactions ──────────────────────────────────────────────────────────

/**
 * "feed.notify.reaction"
 *
 * Fired when someone reacts to a post or comment.
 * Author self-reaction guard applied in feedEventHandlers.js before enqueue.
 *
 * data: {
 *   recipientId:  string  — post/comment author
 *   actorId:      string  — person who reacted
 *   targetType:   "post" | "comment"
 *   targetId:     string
 * }
 */
export const handleFeedNotifyReaction = async ({
  recipientId,
  actorId,
  targetType,
  targetId,
}) => {
  const [recipient, actor] = await Promise.all([
    userService.findUserById(recipientId),
    userService.findUserById(actorId),
  ]);

  if (!recipient || !actor) return;

  const label = targetType === "post" ? "post" : "comment";
  const message = `${actor.username} liked your ${label}.`;

  await NotificationService.send({
    recipientId: recipient._id,
    senderId: actor._id,
    type: "FEED_REACTION",
    title: "New reaction ❤️",
    message,
    channels: ["inApp"],
    payload: {
      targetType,
      targetId,
      actorUsername: actor.username,
      actorAvatar: actor.profilePicture ?? null,
    },
  });
};

export const handleChatMessageNotification = async ({
  recipientId,
  senderId,
  chatRoomId,
  messageId,
  senderUsername,
}) => {
  await NotificationService.send({
    recipientId,
    senderId,
    type: NotificationTypes.CHAT_MESSAGE,
    title: "New message",
    message: `${senderUsername} sent you a message.`,
    channels: ["inApp", "push"],
    payload: {
      chatRoomId,
      messageId,
    },
  });
};

// ─── Handler Registry ─────────────────────────────────────────────────────────

export const jobHandlers = {
  // Auth / Account
  USER_REGISTERED: handleUserRegistered,
  VERIFICATION_SENT: handleVerificationSent,
  PASSWORD_CHANGED: handlePasswordChanged,
  PASSWORD_RESET_REQUESTED: handlePasswordResetRequested,
  PASSWORD_RESET_SUCCESS: handlePasswordResetSuccess,

  // Group
  GROUP_CREATED: handleGroupCreated,
  GROUP_JOIN_REQUESTED: handleGroupJoinRequested,
  GROUP_JOIN_REQUEST_APPROVED: handleGroupJoinRequestApproved,
  GROUP_JOIN_REQUEST_REJECTED: handleGroupJoinRequestRejected,
  GROUP_MEMBER_JOINED: handleGroupMemberJoined,
  GROUP_MEMBER_LEFT: handleGroupMemberLeft,
  GROUP_MEMBER_KICKED: handleGroupMemberKicked,
  GROUP_MEMBER_BANNED: handleGroupMemberBanned,
  GROUP_ROLE_CHANGED: handleGroupRoleChanged,

  // Feed
  "feed.notify.comment": handleFeedNotifyComment,
  "feed.notify.reaction": handleFeedNotifyReaction,

  // Chat
  CHAT_MESSAGE_NOTIFICATION: handleChatMessageNotification,
};
