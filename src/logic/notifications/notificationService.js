import { Worker } from "bullmq";
import NotificationService from "../../logic/notifications/notificationService.js";
import * as userService from "../../user/userService.js";
import * as groupDb from "../../groupLogic/gSchemaService.js";
import { bullMQRedis } from "../../queues/bullmqRedis.js";
import { getEmailTemplate } from "../../logic/notifications/emailTemplates.js";
import { NotificationTypes } from "../../logic/notifications/notificationTypes.js";
import logger from "../../lib/logger.js";

const handleUserRegistered = async ({ userId }) => {
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
      username: user.username,
      email: user.email,
      template: "WELCOME_EMAIL",
      html: getEmailTemplate("WELCOME_EMAIL", {
        username: user.username,
        profileLink: "Coming soon...",
      }),
    },
  });
};

const handleVerificationSent = async ({ userId, verificationCode }) => {
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
      username: user.username,
      email: user.email,
      code: verificationCode,
      template: "OTP_EMAIL",
      html: getEmailTemplate("OTP_EMAIL", {
        username: user.username,
        code: verificationCode,
      }),
    },
  });
};

const handlePasswordChanged = async ({ userId }) => {
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
      username: user.username,
      email: user.email,
      template: "PASSWORD_CHANGED",
      html: getEmailTemplate("PASSWORD_CHANGED", {
        username: user.username,
      }),
    },
  });
};

const handlePasswordResetRequested = async ({ userId, resetLink }) => {
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
      username: user.username,
      email: user.email,
      resetLink,
      template: "PASSWORD_RESET_REQUESTED",
      html: getEmailTemplate("PASSWORD_RESET_REQUESTED", {
        username: user.username,
        resetLink,
      }),
    },
  });
};

const handlePasswordResetSuccess = async ({ userId }) => {
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
      username: user.username,
      email: user.email,
      template: "PASSWORD_RESET_SUCCESS",
      html: getEmailTemplate("PASSWORD_RESET_SUCCESS", {
        username: user.username,
      }),
    },
  });
};

const handleGroupCreated = async ({ userId, groupId }) => {
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
      username: user.username,
      email: user.email,
      groupId: group._id.toString(),
      groupName: group.name,
    },
  });
};

const handleGroupJoinRequested = async ({ groupId, requesterUserId }) => {
  const [group, requester] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(requesterUserId),
  ]);

  if (!group || !requester) return;

  // You still need a real way to get group admins.
  // This should come from membership queries, not Group.createdBy alone.
  const admin = await userService.findUserById(group.createdBy);
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
      adminUsername: admin.username,
      requesterUsername: requester.username,
      groupName: group.name,
      groupId: group._id.toString(),
    },
  });
};

const handleGroupJoinRequestApproved = async ({
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
    senderId: admin?._id || "system",
    type: "GROUP_JOIN_REQUEST_APPROVED",
    title: `You joined "${group.name}" ✅`,
    message: `Your request to join "${group.name}" was approved.`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      username: user.username,
      adminUsername: admin?.username ?? "Admin",
      groupName: group.name,
      groupId: group._id.toString(),
    },
  });
};

const handleGroupJoinRequestRejected = async ({
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
    senderId: admin?._id || "system",
    type: "GROUP_JOIN_REQUEST_REJECTED",
    title: `Join request declined`,
    message: `Your request to join "${group.name}" was declined.`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      username: user.username,
      adminUsername: admin?.username ?? "Admin",
      groupName: group.name,
      groupId: group._id.toString(),
    },
  });
};

const handleGroupMemberJoined = async ({ groupId, userId, via }) => {
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
      username: user.username,
      via: via || "direct",
    },
  });
};

const handleGroupMemberLeft = async ({ groupId, userId }) => {
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
      username: user.username,
    },
  });
};

const handleGroupMemberKicked = async ({ groupId, targetUserId, adminId }) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id || "system",
    type: "GROUP_MEMBER_KICKED",
    title: `Removed from "${group.name}"`,
    message: `You were removed from "${group.name}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      username: user.username,
      adminUsername: admin?.username ?? "Admin",
      groupName: group.name,
      groupId: group._id.toString(),
    },
  });
};

const handleGroupMemberBanned = async ({ groupId, targetUserId, adminId }) => {
  const [group, user, admin] = await Promise.all([
    groupDb.findGroupById(groupId),
    userService.findUserById(targetUserId),
    userService.findUserById(adminId),
  ]);

  if (!group || !user) return;

  await NotificationService.send({
    recipientId: user._id,
    senderId: admin?._id || "system",
    type: "GROUP_MEMBER_BANNED",
    title: `Banned from "${group.name}"`,
    message: `You were banned from "${group.name}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      username: user.username,
      adminUsername: admin?.username ?? "Admin",
      groupName: group.name,
      groupId: group._id.toString(),
    },
  });
};

const handleGroupRoleChanged = async ({
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
    senderId: admin?._id || "system",
    type: "GROUP_ROLE_CHANGED",
    title: `Role updated in "${group.name}"`,
    message: `Your role in "${group.name}" is now "${newRole}".`,
    channels: ["inApp", "email"],
    payload: {
      email: user.email,
      username: user.username,
      adminUsername: admin?.username ?? "Admin",
      groupName: group.name,
      groupId: group._id.toString(),
      newRole,
    },
  });
};

const jobHandlers = {
  USER_REGISTERED: handleUserRegistered,
  VERIFICATION_SENT: handleVerificationSent,
  PASSWORD_CHANGED: handlePasswordChanged,
  PASSWORD_RESET_REQUESTED: handlePasswordResetRequested,
  PASSWORD_RESET_SUCCESS: handlePasswordResetSuccess,
  GROUP_CREATED: handleGroupCreated,
  GROUP_JOIN_REQUESTED: handleGroupJoinRequested,
  GROUP_JOIN_REQUEST_APPROVED: handleGroupJoinRequestApproved,
  GROUP_JOIN_REQUEST_REJECTED: handleGroupJoinRequestRejected,
  GROUP_MEMBER_JOINED: handleGroupMemberJoined,
  GROUP_MEMBER_LEFT: handleGroupMemberLeft,
  GROUP_MEMBER_KICKED: handleGroupMemberKicked,
  GROUP_MEMBER_BANNED: handleGroupMemberBanned,
  GROUP_ROLE_CHANGED: handleGroupRoleChanged,
};

new Worker(
  "notificationQueue",
  async (job) => {
    const handler = jobHandlers[job.name];
    if (!handler) {
      logger.warn(`[NotificationWorker] No handler found for job: ${job.name}`);
      return;
    }

    await handler(job.data);
  },
  { connection: bullMQRedis },
);