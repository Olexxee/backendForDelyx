import mongoose from "mongoose";
import * as groupDb from "./gSchemaService.js";
import * as membershipService from "./membershipService.js";
import * as chatDb from "../models/chatSchemaService.js";
import * as membershipCrud from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import * as tournamentCrud from "../models/tournamentSchemaService.js";
import * as tournamentService from "../tournamentLogic/tournamentService.js";
import { serializeGroup, serializeUser } from "../lib/serializeUser.js";
import { enqueueNotificationJob } from "../queues/notificationQueue.js";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";
import { getOrCreateChatRoom } from "../logic/chats/chatRoomService.js";
import { deleteGroupHubShared } from "../lib/cache/groupHubCache.js";
import {
  BadRequestError,
  ConflictException,
  NotFoundException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// =====================================================
// PRIVATE HELPERS
// =====================================================

const invalidateGroupHub = async (groupId) => {
  if (!groupId) return;
  await deleteGroupHubShared(groupId.toString());
};

const removeUserFromGroupChatRoom = async ({
  groupId,
  userId,
  session = null,
}) => {
  const group = await groupDb.findGroupById(groupId, { session });
  if (!group?.chatRoom) return;

  await mongoose
    .model("ChatRoom")
    .updateOne(
      { _id: group.chatRoom },
      { $pull: { participants: new mongoose.Types.ObjectId(userId) } },
      { session },
    );
};

const ensureUserInGroupChatRoom = async ({
  groupId,
  userId,
  session = null,
}) => {
  const group = await groupDb.findGroupById(groupId, { session });
  if (!group) throw new NotFoundException("Group not found");

  const chatRoom = await getOrCreateChatRoom({
    contextType: "group",
    contextId: group._id,
    userId: new mongoose.Types.ObjectId(userId),
    session,
  });

  if (
    !group.chatRoom ||
    group.chatRoom.toString() !== chatRoom._id.toString()
  ) {
    await groupDb.updateGroup(
      group._id,
      { chatRoom: chatRoom._id },
      { session },
    );
  }

  return chatRoom;
};

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

export const searchGroupsByName = async ({ name, limit = 20 }) => {
  if (!name || !name.trim()) return [];

  const groups = await groupDb.searchGroupsByName({ name, limit });
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
  if (existingGroup) {
    throw new ConflictException("A group with this name already exists");
  }

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
        totalMembers: 1,
        lastActivityAt: new Date(),
      },
      { session },
    );

    if (!group) {
      throw new BadRequestError("Failed to create group");
    }

    await membershipService.createMembership(
      {
        userId: user._id,
        groupId: group._id,
        roleInGroup: "admin",
        status: "active",
        joinedAt: new Date(),
      },
      { session },
    );

    const chatRoom = await getOrCreateChatRoom({
      contextType: "group",
      contextId: group._id,
      userId: user._id,
      session,
    });

    group = await groupDb.updateGroup(
      group._id,
      { chatRoom: chatRoom._id },
      { session },
    );

    await session.commitTransaction();

    await invalidateGroupHub(group._id);

    group = await group.populate([{ path: "avatar" }, { path: "createdBy" }]);

    await enqueueNotificationJob(
      "GROUP_CREATED",
      {
        userId: user._id.toString(),
        groupId: group._id.toString(),
        timestamp: Date.now(),
      },
      {
        idempotencyKey: `GROUP_CREATED:${group._id}:${user._id}`,
      },
    );

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
    select: "name bio avatar privacy totalMembers lastActivityAt",
    populate: [{ path: "avatar" }],
  });

  if (!group || !group.isActive) {
    throw new NotFoundException("Group not found");
  }

  const [
    membership,
    membersPreviewResult,
    activeTournamentsResult,
    pendingCountResult,
  ] = await Promise.all([
    membershipService.findMembership({ userId, groupId }),
    membershipService.getMemberPreview(groupId),
    tournamentService.getGroupTournaments(groupId, "ongoing"),
    membershipService.countPendingRequests(groupId).catch(() => 0),
  ]);

  if (!membership && group.privacy !== "public") {
    throw new ForbiddenError("You are not a member of this group");
  }

  const myRole = membership?.roleInGroup || "member";
  const membersPreview = membersPreviewResult || [];
  const activeTournament = activeTournamentsResult?.[0] ?? null;

  let tournamentPreview = null;

  if (activeTournament?._id) {
    try {
      tournamentPreview = await tournamentService.getTournamentPreview({
        tournamentId: activeTournament._id,
        userId,
      });
    } catch (error) {
      console.warn(
        `Failed to fetch preview for tournament ${activeTournament._id}`,
        error,
      );
      tournamentPreview = null;
    }
  }

  return {
    id: group._id,
    name: group.name,
    description: group.bio || null,
    avatar: group.avatar?.url || null,
    privacy: group.privacy,
    memberCount: group.totalMembers || 0,
    myRole,
    pendingJoinRequestCount: myRole === "admin" ? pendingCountResult : null,
    activeTournament: activeTournament || null,
    tournamentPreview,
    membersPreview,
    lastActivityAt: group.lastActivityAt,
  };
};

// =====================================================
// GET MY GROUPS
// =====================================================

export const getMyGroups = async ({ userId, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const memberships = await membershipCrud.findGroupsByUser({ userId });
  if (!memberships?.length) return [];

  const groupIds = memberships.map((m) => m.groupId);

  console.log(
    memberships.map((m) => ({
      groupId: m.groupId,
      type: typeof m.groupId,
      role: m.roleInGroup,
    })),
  );

  const membershipMap = new Map(
    memberships.map((m) => [m.groupId.toString(), m.roleInGroup]),
  );

  const [groups, activeTournaments, chatRooms] = await Promise.all([
    groupDb.findGroupsByIds(groupIds, { skip, limit }),
    tournamentCrud.findActiveTournamentsByGroups(groupIds),
    chatDb.findChatRoomsByGroupIds(groupIds),
  ]);

  const activeTournamentMap = new Map(
    activeTournaments.map((t) => [t.groupId.toString(), t]),
  );


  const chatRoomMap = new Map(
    chatRooms.map((r) => [r.contextId.toString(), r._id.toString()]),
  );

  return groups.map((g) => {
    const id = g._id.toString();
    const tournament = activeTournamentMap.get(id) ?? null;

    return {
      id,
      name: g.name,
      chatRoomId: chatRoomMap.get(id) ?? null,
      description: g.bio ?? null,
      avatar: g.avatar?.url ?? null,
      privacy: g.privacy,
      totalMembers: g.totalMembers ?? 0,
      myRole: membershipMap.get(id) ?? "member",
      activeTournament: tournament
        ? {
            id: tournament._id.toString(),
            name: tournament.name,
            status: tournament.status,
          }
        : null,
      lastActivityAt: g.lastActivityAt,
    };
  });
};

// =====================================================
// REQUEST TO JOIN GROUP
// =====================================================

export const requestToJoinGroup = async ({ groupId, userId }) => {
  const group = await groupDb.findGroupById(groupId, { select: "privacy" });
  if (!group) throw new NotFoundException("Group not found");

  if (group.privacy === "public") {
    const existing = await membershipService.findMembership({
      userId,
      groupId,
    });

    if (existing) {
      if (existing.status === "active") {
        return existing;
      }

      throw new ConflictException("Already a member or pending request");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const membership = await membershipService.createMembership(
        {
          userId,
          groupId,
          roleInGroup: "member",
          status: "active",
          joinedAt: new Date(),
        },
        { session },
      );

      await ensureUserInGroupChatRoom({ groupId, userId, session });

      await groupDb.updateGroup(
        groupId,
        { lastActivityAt: new Date() },
        { session },
      );

      await session.commitTransaction();

      await invalidateGroupHub(groupId);

      setImmediate(async () => {
        await enqueueNotificationJob("GROUP_MEMBER_JOINED", {
          groupId: groupId.toString(),
          userId: userId.toString(),
          via: "public_join",
        });
      });

      return membership;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  const existingRequest = await membershipService.findMembership({
    userId,
    groupId,
  });

  if (existingRequest) {
    if (existingRequest.status === "pending") {
      return existingRequest;
    }

    throw new ConflictException("You are already a member");
  }

  const request = await membershipService.requestToJoinGroup({
    userId,
    groupId,
  });

  setImmediate(() => {
    enqueueNotificationJob("GROUP_JOIN_REQUESTED", {
      groupId: groupId.toString(),
      requesterUserId: userId.toString(),
    });
  });

  return request;
};

// =====================================================
// NOTE
// =====================================================
//
// Apply the same invalidation rule to the remaining write-side methods
// in this file after successful commit/completion:
//
// await invalidateGroupHub(groupId);
//
// Specifically:
// - approveGroupJoinRequest
// - leaveGroup
// - kickUserFromGroup
// - changeMemberRole
// - updateGroupMedia
//
// Do NOT invalidate before transaction commit.
// Do NOT invalidate read-only methods.
