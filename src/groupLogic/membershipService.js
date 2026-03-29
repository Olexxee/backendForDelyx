import mongoose from "mongoose";
import * as membershipDb from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import * as userStats from "../user/statschemaService.js";
import * as groupDb from "./gSchemaService.js";
import { notificationQueue } from "../queues/notificationQueue.js";
import {
  NotFoundException,
  ConflictException,
  ForbiddenError,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// ============================================================
// PRIVATE HELPERS
// ============================================================

const ensureGroupExists = async ({ groupId, session = null }) => {
  const group = await groupDb.findGroupById(groupId, { session });

  if (!group) {
    throw new NotFoundException("Group not found");
  }

  return group;
};

const enqueueMembershipNotification = async (name, data) => {
  await notificationQueue.add(name, data, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
};

// ============================================================
// CREATE MEMBERSHIP
// ============================================================

export const createMembership = async (payload) => {
  const {
    userId,
    groupId,
    roleInGroup = "member",
    status = "active",
  } = payload;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await ensureGroupExists({ groupId, session });

    const existing = await membershipDb.findMembership(
      { userId, groupId },
      { session },
    );

    if (existing) {
      await session.commitTransaction();
      return existing;
    }

    const membership = await membershipDb.createMembership(
      {
        userId,
        groupId,
        roleInGroup,
        status,
      },
      { session },
    );

    if (status === "active") {
      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: 1 } },
        { session },
      );

      await userService.findAndUpdateUserById(
        userId,
        { $addToSet: { groups: groupId } },
        { session },
      );

      await userStats.createUserStats(
        {
          user: userId,
          group: groupId,
          tournamentId: null,
        },
        { session },
      );
    }

    await session.commitTransaction();
    return membership;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// FIND MEMBERSHIP
// ============================================================

export const findMembership = async ({ userId, groupId }) => {
  return membershipDb.findMembership({ userId, groupId });
};

// ============================================================
// GET ALL ACTIVE MEMBERS IN GROUP
// ============================================================

export const findAllMembersInGroup = async ({
  groupId,
  skip = 0,
  limit = 50,
}) => {
  return membershipDb.findMembersByGroupId(
    { groupId, status: "active" },
    { skip, limit },
  );
};

// ============================================================
// GET ALL GROUPS FOR USER
// ============================================================

export const findGroupsByUser = async ({ userId, status = "active" }) => {
  return membershipDb.findGroupsByUser({ userId, status });
};

// ============================================================
// UPDATE MEMBERSHIP
// ============================================================

export const updateMembership = async (payload) => {
  const { userId, groupId, ...updateFields } = payload;

  return membershipDb.updateMembership(
    { userId, groupId },
    updateFields,
    { new: true },
  );
};

// ============================================================
// REMOVE MEMBERSHIP
// ============================================================

export const removeMembership = async ({ userId, groupId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const existing = await membershipDb.findMembership(
      { userId, groupId },
      { session },
    );

    if (!existing) {
      await session.commitTransaction();
      return null;
    }

    const deleted = await membershipDb.removeMembership(
      { userId, groupId },
      { session },
    );

    if (existing.status === "active") {
      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: -1 } },
        { session },
      );

      await userService.findAndUpdateUserById(
        userId,
        { $pull: { groups: groupId } },
        { session },
      );
    }

    await session.commitTransaction();
    return deleted;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// ASSERT ADMIN
// ============================================================

export const assertIsAdmin = async ({ userId, groupId }) => {
  const membership = await membershipDb.findMembership({ userId, groupId });

  if (
    !membership ||
    membership.status !== "active" ||
    membership.roleInGroup !== "admin"
  ) {
    throw new ForbiddenError("Only group admins can perform this action");
  }
};

// ============================================================
// REQUEST TO JOIN GROUP
// ============================================================

export const requestToJoinGroup = async ({ userId, groupId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await ensureGroupExists({ groupId, session });

    const existing = await membershipDb.findMembership(
      { userId, groupId },
      { session },
    );

    if (existing) {
      await session.commitTransaction();

      if (existing.status === "pending") {
        throw new ConflictException("You already have a pending join request");
      }

      if (existing.status === "active") {
        throw new ConflictException("You are already a member of this group");
      }

      if (existing.status === "banned") {
        throw new ForbiddenError("You are banned from this group");
      }

      throw new ConflictException("Membership already exists");
    }

    const membership = await membershipDb.createMembership(
      {
        userId,
        groupId,
        roleInGroup: "member",
        status: "pending",
      },
      { session },
    );

    await session.commitTransaction();

    await enqueueMembershipNotification("GROUP_JOIN_REQUESTED", {
      groupId: groupId.toString(),
      requesterUserId: userId.toString(),
    });

    return membership;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// RESOLVE JOIN REQUEST
// ============================================================

export const resolveJoinRequest = async ({
  adminId,
  groupId,
  targetUserId,
  action,
}) => {
  if (!["approve", "reject"].includes(action)) {
    throw new BadRequestError("Action must be 'approve' or 'reject'");
  }

  await assertIsAdmin({ userId: adminId, groupId });

  const targetMembership = await membershipDb.findMembership({
    userId: targetUserId,
    groupId,
  });

  if (!targetMembership) {
    throw new NotFoundException("No join request found for this user");
  }

  if (targetMembership.status !== "pending") {
    throw new ConflictException("This user does not have a pending request");
  }

  if (action === "reject") {
    await membershipDb.removeMembership({ userId: targetUserId, groupId });

    await enqueueMembershipNotification("GROUP_JOIN_REQUEST_REJECTED", {
      groupId: groupId.toString(),
      targetUserId: targetUserId.toString(),
      adminId: adminId.toString(),
    });

    return { action: "rejected", userId: targetUserId };
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const approved = await membershipDb.updateMembership(
      { userId: targetUserId, groupId },
      { status: "active" },
      { new: true, session },
    );

    await groupDb.updateGroup(
      groupId,
      { $inc: { totalMembers: 1 } },
      { session },
    );

    await userService.findAndUpdateUserById(
      targetUserId,
      { $addToSet: { groups: groupId } },
      { session },
    );

    await userStats.createUserStats(
      {
        user: targetUserId,
        group: groupId,
        tournamentId: null,
      },
      { session },
    );

    await session.commitTransaction();

    await enqueueMembershipNotification("GROUP_JOIN_REQUEST_APPROVED", {
      groupId: groupId.toString(),
      targetUserId: targetUserId.toString(),
      adminId: adminId.toString(),
    });

    return {
      action: "approved",
      membership: approved,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// COUNT PENDING REQUESTS
// ============================================================

export const countPendingRequests = async (groupId, status = "pending") => {
  return membershipDb.countMemberships({ groupId, status });
};

// ============================================================
// GET PENDING REQUESTS
// ============================================================

export const getPendingRequests = async ({ groupId, limit = 20 }) => {
  return membershipDb.findMembersByGroupId(
    { groupId, status: "pending" },
    {
      limit,
      populate: [{ path: "userId", select: "username email profilePicture" }],
    },
  );
};

// ============================================================
// BAN USER
// ============================================================

export const banUserInGroup = async ({ adminId, groupId, targetUserId }) => {
  await assertIsAdmin({ userId: adminId, groupId });

  const targetMembership = await membershipDb.findMembership({
    userId: targetUserId,
    groupId,
  });

  if (!targetMembership) {
    throw new NotFoundException("User not in this group");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const updated = await membershipDb.updateMembership(
      { userId: targetUserId, groupId },
      { status: "banned" },
      { new: true, session },
    );

    if (targetMembership.status === "active") {
      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: -1 } },
        { session },
      );

      await userService.findAndUpdateUserById(
        targetUserId,
        { $pull: { groups: groupId } },
        { session },
      );
    }

    await session.commitTransaction();

    await enqueueMembershipNotification("GROUP_MEMBER_BANNED", {
      groupId: groupId.toString(),
      targetUserId: targetUserId.toString(),
      adminId: adminId.toString(),
    });

    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};