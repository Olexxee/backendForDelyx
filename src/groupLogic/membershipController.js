import * as membershipService from "./membershipService.js";
import * as userService from "../user/userService.js";
import { asyncWrapper } from "../lib/utils.js";
import { BadRequestError } from "../lib/classes/errorClasses.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";

const validator = new ValidatorClass();

// Join group (membership creation)
export const joinGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  const membership = await membershipService.createMembership({
    userId,
    groupId,
  });

  await userService.addGroupToUser({ userId, groupId });

  if (membership) {
    await userService.findUserByIdAndUpdate(userId, {
      $inc: { groupsJoinedCount: 1 },
      $push: { groupsJoined: groupId },
    });
  }

  res.status(201).json({
    success: true,
    message: "Joined group successfully",
    membership,
  });
});

// Leave group
export const leaveGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  await membershipService.removeMembership({ userId, groupId });

  res.status(200).json({
    success: true,
    message: "Left group successfully",
  });
});

// Get all members of a group
export const getGroupMembers = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const members = await membershipService.findAllMembersInGroup(groupId);

  res.status(200).json({
    success: true,
    members,
  });
});

// Get all groups a user belongs to
export const getUserGroups = asyncWrapper(async (req, res) => {
  const userId = req.user._id;
  const groups = await membershipService.findGroupsByUser(userId);

  console.log("control hit");

  res.status(200).json({
    success: true,
    groups,
  });
});

// Update membership (e.g. change role or status)
export const updateMembership = asyncWrapper(async (req, res) => {
  const { groupId, userId } = req.params;
  const updateData = req.body;

  const existing = await membershipService.findMembership({ userId, groupId });
  if (!existing) throw new BadRequestError("Membership not found");

  if (existing.roleInGroup === "admin" && updateData.roleInGroup === "admin") {
    throw new BadRequestError("User is already an admin.");
  }

  const updated = await membershipService.updateMembership({
    userId,
    groupId,
    ...updateData,
  });

  res.status(200).json({
    success: true,
    message: `${userId} membership in group has been updated to ${updateData.roleInGroup}`,
    updated,
  });
});

// Ban a user from a group
export const banUser = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const adminId = req.user._id;

  const result = await membershipService.banUserInGroup({
    adminId,
    groupId,
    targetUserId,
  });

  res.status(200).json({
    success: true,
    message: "User has been banned",
    result,
  });
});
