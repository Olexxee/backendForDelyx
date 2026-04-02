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
import {
  BadRequestError,
  ConflictException,
  NotFoundException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// =====================================================
// PRIVATE HELPERS (Optimized)
// =====================================================

const removeUserFromGroupChatRoom = async ({
  groupId,
  userId,
  session = null,
}) => {
  const group = await groupDb.findGroupById(groupId, { session });
  if (!group?.chatRoom) return;

  // Use updateOne with $pull instead of model access if possible
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

  // Only update group if needed
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
// SEARCH GROUPS (Now uses text index or external search)
// =====================================================

export const searchGroupsByName = async ({ name, limit = 20 }) => {
  if (!name || !name.trim()) return [];

  // ✅ Option 1: Use MongoDB Text Index (if you add it)
  // Ensure you have: GroupSchema.index({ name: "text", bio: "text" })
  /*
  const groups = await groupDb.searchGroupsByText(name.trim(), { limit });
  */

  // ✅ Option 2: Forward to a scalable search service (Recommended for 1M+)
  // This is a stub. In practice, use Meilisearch/Elasticsearch.
  const groups = await groupDb.searchGroupsByName({ name, limit }); // Current regex fallback

  return groups.map(serializeGroup);
};

// =====================================================
// CREATE GROUP (Optimized)
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
        totalMembers: 1, // Initial count (admin only)
        lastActivityAt: new Date(),
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

    // Populate after commit to avoid blocking transaction
    group = await group.populate([{ path: "avatar" }, { path: "createdBy" }]);

    // ✅ Enqueue job with idempotency key
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
// GET GROUP OVERVIEW (Optimized)
// =====================================================
export const getGroupOverview = async ({ groupId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new BadRequestError("Invalid group id");
  }

  const group = await groupDb.findGroupById(groupId, {
    select: "name bio avatar privacy totalMembers lastActivityAt",
    populate: [{ path: "avatar" }],
  });

  if (!group || !group.isActive) throw new NotFoundException("Group not found");

  const [
    membership,
    membersPreviewPromise,
    activeTournamentsPromise,
    pendingCountPromise,
  ] = await Promise.all([
    membershipService.findMembership({ userId, groupId }),
    membershipCrud.getMemberPreview(groupId),
    tournamentService.getGroupTournaments(groupId, "ongoing"),
    membershipService.countPendingRequests(groupId).catch(() => 0), // Fail-safe
  ]);

  // Check access
  if (!membership && group.privacy !== "public") {
    throw new ForbiddenError("You are not a member of this group");
  }

  const myRole = membership?.roleInGroup || "member";
  const membersPreview = membersPreviewPromise || [];
  const activeTournament = (await activeTournamentsPromise)?.[0] ?? null;

  let tournamentPreview = null;
  if (activeTournament?._id) {
    try {
      tournamentPreview = await tournamentService.getTournamentPreview({
        tournamentId: activeTournament._id,
        userId,
      });
    } catch (e) {
      console.warn(
        `Failed to fetch preview for tournament ${activeTournament._id}`,
        e,
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
    pendingJoinRequestCount: myRole === "admin" ? pendingCountPromise : null,
    activeTournament: activeTournament || null,
    tournamentPreview,
    membersPreview,
    lastActivityAt: group.lastActivityAt,
  };
};

export const getMyGroups = async ({ userId, page = 1, limit = 10 }) => {
  const skip = (page - 1) * limit;

  const memberships = await membershipCrud.findMembershipsByUser(userId);
  const groupIds = memberships.map((m) => m.groupId);

  const membershipMap = new Map(
    memberships.map((m) => [m.groupId.toString(), m.roleInGroup]),
  );

  const groups = await groupDb.Model.find({ _id: { $in: groupIds } })
    .sort({ lastActivityAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("activeTournament", "name status")
    .populate("avatar")
    .lean();

  return groups.map((g) => ({
    id: g._id.toString(),
    name: g.name,
    description: g.bio ?? null,
    avatar: g.avatar?.url ?? null,
    privacy: g.privacy,
    totalMembers: g.totalMembers ?? 0,
    myRole: membershipMap.get(g._id.toString()) ?? "member",
    activeTournament: g.activeTournament || null,
    lastActivityAt: g.lastActivityAt,
  }));
};

// =====================================================
// REQUEST TO JOIN GROUP (Idempotent & Safe)
// =====================================================

export const requestToJoinGroup = async ({ groupId, userId }) => {
  const group = await groupDb.findGroupById(groupId, { select: "privacy" });
  if (!group) throw new NotFoundException("Group not found");

  // ✅ Handle public join safely
  if (group.privacy === "public") {
    const existing = await membershipService.findMembership({
      userId,
      groupId,
    });
    if (existing) {
      if (existing.status === "active") {
        return existing; // Idempotency: already a member
      }
      // If pending, we could resolve or ignore – depends on business logic
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

      // ✅ Update activity
      await groupDb.updateGroup(
        groupId,
        { lastActivityAt: new Date() },
        { session },
      );

      await session.commitTransaction();

      // ✅ Fire async job (don't wait)
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

  // Private group: request flow
  const existingRequest = await membershipService.findMembership({
    userId,
    groupId,
  });
  if (existingRequest) {
    if (existingRequest.status === "pending") {
      return existingRequest; // Idempotency
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
