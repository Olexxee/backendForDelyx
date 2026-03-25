import mongoose from "mongoose";
import * as groupDb from "./gSchemaService.js";
import * as membershipService from "./membershipService.js";
import * as userService from "../user/userService.js";
import { serializeGroup, serializeUser } from "../lib/serializeUser.js";
import { enqueueNotificationJob } from "../queues/notificationQueue.js";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";
import { getOrCreateChatRoom } from "../logic/chats/chatRoomService.js";
import {
  BadRequestError,
  ConflictException,
  NotFoundException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// =====================================================
// PRIVATE HELPERS
// =====================================================
const ensureAdminMembership = async ({ userId, groupId }) => {
  const membership = await membershipService.findMembership({ userId, groupId });

  if (!membership || membership.status !== "active" || membership.roleInGroup !== "admin") {
    throw new ForbiddenError("Only admins can perform this action");
  }

  return membership;
};

// =====================================================
// CREATE GROUP
// =====================================================

export const createGroup = async ({
  userId,
  name,
  privacy,
  avatar,
  chatBroadcaster,
}) => {
  const user = await userService.findUserById(userId);
  if (!user) throw new NotFoundException("User not found");

  const existingGroup = await groupDb.findGroupByName(name);
  if (existingGroup) throw new ConflictException("A group with this name already exists");

  const aesKey = generateRoomKey();

  let group = await groupDb.createGroup({
    name,
    privacy,
    avatar,
    createdBy: user._id,
    aesKey,
    totalMembers: 0,
  });

  if (!group) throw new BadRequestError("Failed to create group");

  await membershipService.createMembership({
    userId: user._id,
    groupId: group._id,
    roleInGroup: "admin",
    status: "active",
  });

  const chatRoom = await getOrCreateChatRoom({
    contextType: "group",
    contextId: group._id,
    userId: user._id,
  });

  group = await groupDb.updateGroup(group._id, { chatRoom: chatRoom._id });
  group = await group.populate([{ path: "avatar" }, { path: "createdBy" }]);

  // ✅ New Notification Pattern
  await enqueueNotificationJob("GROUP_CREATED", {
    userId: user._id.toString(),
    groupId: group._id.toString(),
  });

  if (chatBroadcaster?.broadcastMessage) {
    chatBroadcaster.broadcastMessage(group._id, {
      system: true,
      content: `Group "${group.name}" created!`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  const refreshedUser = await userService.findUserById(userId);

  return {
    group: serializeGroup(group),
    chatRoom,
    user: refreshedUser ? serializeUser(refreshedUser) : null,
  };
};

// =====================================================
// REQUEST TO JOIN GROUP
// =====================================================

export const requestToJoinGroup = async ({ groupId, userId }) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  if (group.privacy === "public") {
    const existing = await membershipService.findMembership({ userId, groupId });
    if (existing) throw new ConflictException("Already a member or pending request");

    const membership = await membershipService.createMembership({
      userId,
      groupId,
      roleInGroup: "member",
      status: "active",
    });

    // ✅ Notify that a member joined a public group
    await enqueueNotificationJob("GROUP_MEMBER_JOINED", {
      groupId: groupId.toString(),
      userId: userId.toString(),
      via: "public_join",
    });

    return membership;
  }

  const request = await membershipService.requestToJoinGroup({ userId, groupId });

  // ✅ Notify Admins of the new request
  await enqueueNotificationJob("GROUP_JOIN_REQUESTED", {
    groupId: groupId.toString(),
    requesterUserId: userId.toString(),
  });

  return request;
};

// =====================================================
// JOIN GROUP BY INVITE
// =====================================================

export const joinGroupByInvite = async (joinCode, userId) => {
  const group = await groupDb.findGroupByJoinCode(joinCode);
  if (!group) throw new NotFoundException("Invalid invite link or group");

  const existing = await membershipService.findMembership({ userId, groupId: group._id });
  if (existing) throw new ConflictException("You are already a member");

  const membership = await membershipService.createMembership({
    userId,
    groupId: group._id,
    roleInGroup: "member",
    status: "active",
  });

  // ✅ Trigger join notification via worker
  await enqueueNotificationJob("GROUP_MEMBER_JOINED", {
    groupId: group._id.toString(),
    userId: userId.toString(),
    via: "invite",
  });

  return membership;
};

// =====================================================
// LEAVE GROUP
// =====================================================

export const leaveGroup = async (userId, groupId) => {
  const membership = await membershipService.findMembership({ userId, groupId });
  if (!membership) throw new NotFoundException("You are not a member");

  if (membership.roleInGroup === "admin") {
    throw new ForbiddenError("Admin cannot leave without transferring ownership");
  }

  await membershipService.removeMembership({ userId, groupId });

  // ✅ Notify user they left
  await enqueueNotificationJob("GROUP_MEMBER_LEFT", {
    groupId: groupId.toString(),
    userId: userId.toString(),
  });

  return true;
};

// =====================================================
// APPROVE JOIN REQUEST
// =====================================================

export const approveGroupJoinRequest = async ({ adminId, groupId, targetUserId }) => {
  // 1. Verify the person approving is actually an admin
  await ensureAdminMembership({ userId: adminId, groupId });

  // 2. Update the membership status from 'pending' to 'active'
  const updated = await membershipService.updateMembershipStatus({
    userId: targetUserId,
    groupId,
    status: "active",
  });

  if (!updated) {
    throw new BadRequestError("Failed to approve request or request not found");
  }

  // 3. Increment total members in the group document
  await groupDb.incrementMemberCount(groupId, 1);

  // ✅ Notify the user they've been accepted
  await enqueueNotificationJob("GROUP_JOIN_REQUEST_APPROVED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
  });

  return updated;
};

// =====================================================
// REJECT JOIN REQUEST
// =====================================================

export const rejectGroupJoinRequest = async ({ adminId, groupId, targetUserId }) => {
  // 1. Verify admin permissions
  await ensureAdminMembership({ userId: adminId, groupId });

  // 2. Remove the pending membership record
  const deleted = await membershipService.removeMembership({
    userId: targetUserId,
    groupId,
  });

  if (!deleted) {
    throw new BadRequestError("Failed to reject request");
  }

  // ✅ Notify the user their request was declined
  await enqueueNotificationJob("GROUP_JOIN_REQUEST_REJECTED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
  });

  return true;
};

// =====================================================
// KICK MEMBER
// =====================================================

export const kickUserFromGroup = async ({ adminId, groupId, targetUserId }) => {
  await ensureAdminMembership({ userId: adminId, groupId });

  const targetMembership = await membershipService.findMembership({ userId: targetUserId, groupId });
  if (!targetMembership) throw new NotFoundException("Target user not found");

  await membershipService.removeMembership({ userId: targetUserId, groupId });

  // ✅ Notify target they were kicked
  await enqueueNotificationJob("GROUP_MEMBER_KICKED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
  });

  return true;
};

// =====================================================
// CHANGE MEMBER ROLE
// =====================================================

export const changeMemberRole = async ({ adminId, groupId, targetUserId, newRole }) => {
  await ensureAdminMembership({ userId: adminId, groupId });

  const updated = await membershipService.updateMembership({
    userId: targetUserId,
    groupId,
    roleInGroup: newRole,
  });

  if (!updated) throw new BadRequestError("Failed to update role");

  // ✅ Notify target of the role change
  await enqueueNotificationJob("GROUP_ROLE_CHANGED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
    newRole,
  });

  return updated;
};