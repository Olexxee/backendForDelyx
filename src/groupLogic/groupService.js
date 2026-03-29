import mongoose from "mongoose";
import * as groupDb from "./gSchemaService.js";
import * as membershipService from "./membershipService.js";
import * as membershipCrud from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import * as tournamentService from "../tournamentLogic/tournamentService.js";
import { serializeGroup, serializeUser } from "../lib/serializeUser.js";
import { enqueueNotificationJob } from "../queues/notificationQueue.js";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";
import { getOrCreateChatRoom } from "../logic/chats/chatRoomService.js";
import configService from "../lib/classes/configClass.js";
import {
  BadRequestError,
  ConflictException,
  NotFoundException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// =====================================================
// PRIVATE HELPERS
// =====================================================

const ensureAdminMembership = async ({ userId, groupId, session }) => {
  const membership = await membershipService.findMembership(
    { userId, groupId },
    { session },
  );

  if (
    !membership ||
    membership.status !== "active" ||
    membership.roleInGroup !== "admin"
  ) {
    throw new ForbiddenError("Only admins can perform this action");
  }

  return membership;
};

// =====================================================
// SEARCH GROUPS
// =====================================================

export const searchGroupsByName = async ({ name }) => {
  const groups = await groupDb.searchGroupsByName({ name });
  return groups.map(serializeGroup);
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
  if (existingGroup)
    throw new ConflictException("A group with this name already exists");

  const aesKey = generateRoomKey();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let [group] = await groupDb.createGroup(
      {
        name,
        privacy,
        avatar,
        createdBy: user._id,
        aesKey,
        totalMembers: 0,
      },
      { session },
    );

    if (!group) throw new BadRequestError("Failed to create group");

    await membershipService.createMembership(
      {
        userId: user._id,
        groupId: group._id,
        roleInGroup: "admin",
        status: "active",
      },
      { session },
    );

    const chatRoom = await getOrCreateChatRoom(
      {
        contextType: "group",
        contextId: group._id,
        userId: user._id,
      },
      { session },
    );

    group = await groupDb.updateGroup(
      group._id,
      { chatRoom: chatRoom._id },
      { session },
    );

    await session.commitTransaction();

    group = await group.populate([{ path: "avatar" }, { path: "createdBy" }]);

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
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// =====================================================
// GET GROUP OVERVIEW
// =====================================================

export const getGroupOverview = async ({ groupId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new BadRequestError("Invalid group id");
  }

  const group = await groupDb.findGroupById(groupId, {
    populate: [{ path: "avatar" }],
  });

  if (!group || !group.isActive) {
    throw new NotFoundException("Group not found");
  }

  const membership = await membershipService.findMembership({ userId, groupId });

  if (!membership && group.privacy !== "public") {
    throw new ForbiddenError("You are not a member of this group");
  }

  const myRole = membership?.roleInGroup || "member";

  const membersPreview = (await membershipCrud.getMemberPreview(groupId)) || [];

  // getGroupTournaments returns an array — pick the first ongoing one
  const activeTournaments = await tournamentService.getGroupTournaments(
    groupId,
    "ongoing",
  );
  const activeTournament = activeTournaments?.[0] ?? null;

  let tournamentPreview = null;
  if (activeTournament?._id) {
    try {
      tournamentPreview = await tournamentService.getTournamentPreview({
        tournamentId: activeTournament._id,
        userId,
      });
    } catch {
      tournamentPreview = null;
    }
  }

  let pendingJoinRequestCount = null;
  if (myRole === "admin") {
    pendingJoinRequestCount =
      (await membershipService.countPendingRequests(groupId)) || 0;
  }

  return {
    id: group._id,
    name: group.name,
    description: group.bio || null,
    avatar: group.avatar?.url || null,
    privacy: group.privacy,
    memberCount: group.totalMembers || 0,
    myRole,
    pendingJoinRequestCount,
    activeTournament: activeTournament || null,
    tournamentPreview,
    membersPreview,
  };
};

// =====================================================
// UPDATE GROUP MEDIA
// =====================================================

export const updateGroupMedia = async ({
  groupId,
  userId,
  avatarMediaId,
  bannerMediaId,
}) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  await ensureAdminMembership({ userId, groupId });

  if (avatarMediaId) group.avatar = avatarMediaId;
  if (bannerMediaId) group.banner = bannerMediaId;

  await group.save();

  return serializeGroup(await group.populate({ path: "avatar" }));
};

// =====================================================
// REQUEST TO JOIN GROUP
// =====================================================

export const requestToJoinGroup = async ({ groupId, userId }) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  if (group.privacy === "public") {
    const existing = await membershipService.findMembership({ userId, groupId });
    if (existing)
      throw new ConflictException("Already a member or pending request");

    const membership = await membershipService.createMembership({
      userId,
      groupId,
      roleInGroup: "member",
      status: "active",
    });

    await enqueueNotificationJob("GROUP_MEMBER_JOINED", {
      groupId: groupId.toString(),
      userId: userId.toString(),
      via: "public_join",
    });

    return membership;
  }

  const request = await membershipService.requestToJoinGroup({ userId, groupId });

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

  const existing = await membershipService.findMembership({
    userId,
    groupId: group._id,
  });
  if (existing) throw new ConflictException("You are already a member");

  const membership = await membershipService.createMembership({
    userId,
    groupId: group._id,
    roleInGroup: "member",
    status: "active",
  });

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

  await enqueueNotificationJob("GROUP_MEMBER_LEFT", {
    groupId: groupId.toString(),
    userId: userId.toString(),
  });

  return true;
};

// =====================================================
// APPROVE JOIN REQUEST
// =====================================================

export const approveGroupJoinRequest = async ({
  adminId,
  groupId,
  targetUserId,
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await ensureAdminMembership({ userId: adminId, groupId, session });

    const updated = await membershipService.updateMembershipStatus(
      { userId: targetUserId, groupId, status: "active" },
      { session },
    );

    if (!updated) {
      throw new BadRequestError("Failed to approve request or request not found");
    }

    await groupDb.incrementMemberCount(groupId, 1, { session });

    await session.commitTransaction();

    await enqueueNotificationJob("GROUP_JOIN_REQUEST_APPROVED", {
      groupId: groupId.toString(),
      targetUserId: targetUserId.toString(),
      adminId: adminId.toString(),
    });

    return updated;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// =====================================================
// REJECT JOIN REQUEST
// =====================================================

export const rejectGroupJoinRequest = async ({
  adminId,
  groupId,
  targetUserId,
}) => {
  await ensureAdminMembership({ userId: adminId, groupId });

  const deleted = await membershipService.removeMembership({
    userId: targetUserId,
    groupId,
  });

  if (!deleted) throw new BadRequestError("Failed to reject request");

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

  const targetMembership = await membershipService.findMembership({
    userId: targetUserId,
    groupId,
  });
  if (!targetMembership) throw new NotFoundException("Target user not found");

  await membershipService.removeMembership({ userId: targetUserId, groupId });

  await enqueueNotificationJob("GROUP_MEMBER_KICKED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
  });

  return true;
};

// =====================================================
// GENERATE INVITE LINK
// =====================================================

export const generateInviteLink = async ({ adminId, groupId }) => {
  await ensureAdminMembership({ userId: adminId, groupId });

  const inviteCode = await groupDb.createInviteCode(groupId);

  return `${configService.getBaseUrl()}/groups/join/${inviteCode}`;
};

// =====================================================
// GET USER GROUPS WITH LAST MESSAGE
// =====================================================

export const getUserGroupsWithLastMessage = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  const skip = (page - 1) * limit;

  const memberships = await membershipService.findGroupsByUser({
    userId,
    status: "active",
  });

  if (!Array.isArray(memberships) || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.groupId).filter(Boolean);
  if (groupIds.length === 0) return [];

  const groups = await groupDb.findUserGroupsWithLastMessage({
    groupIds,
    skip,
    limit,
  });

  return groups.map((group) => ({
    _id: group._id,
    name: group.name,
    avatar: group.avatar ?? null,
    chatRoomId: group.chatRoomId ?? null,
    lastMessage: group.lastMessage ?? null,
    lastMessageAt: group.lastMessageAt ?? null,
  }));
};

// =====================================================
// CHANGE MEMBER ROLE
// =====================================================

export const changeMemberRole = async ({
  adminId,
  groupId,
  targetUserId,
  newRole,
}) => {
  await ensureAdminMembership({ userId: adminId, groupId });

  const updated = await membershipService.updateMembership({
    userId: targetUserId,
    groupId,
    roleInGroup: newRole,
  });

  if (!updated) throw new BadRequestError("Failed to update role");

  await enqueueNotificationJob("GROUP_ROLE_CHANGED", {
    groupId: groupId.toString(),
    targetUserId: targetUserId.toString(),
    adminId: adminId.toString(),
    newRole,
  });

  return updated;
};