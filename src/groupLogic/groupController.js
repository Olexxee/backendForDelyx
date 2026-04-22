import * as groupService from "../groupLogic/groupService.js";
import * as membershipService from "./membershipService.js";
import { asyncWrapper } from "../lib/utils.js";
import { validator } from "../lib/classes/validatorClass.js";
import { createGroupSchema } from "./groupRequestSchema.js";
import { processUploadedMedia } from "../middlewares/processUploadedImages.js";
import { ValidationException } from "../lib/classes/errorClasses.js";


// =====================================================
// SEARCH GROUP BY NAME
// =====================================================

export const searchGroupByName = asyncWrapper(async (req, res) => {
  const { name } = req.params;
  const groups = await groupService.searchGroupsByName({ name });
  res.status(200).json({ success: true, groups });
});

// =====================================================
// CREATE GROUP
// =====================================================

export const createGroup = asyncWrapper(async (req, res) => {
  const value = validator.validate(createGroupSchema, req.body);
  const avatarFiles = req.files?.avatar;

  const [avatarMedia] = await processUploadedMedia(
    avatarFiles,
    "group",
    req.user,
    {
      role: "avatar",
      resizeWidth: 500,
      resizeHeight: 500,
      minCount: 1,
    },
  );

  const result = await groupService.createGroup({
    userId: req.user._id,
    name: value.name,
    privacy: value.privacy,
    avatar: avatarMedia._id,
    chatBroadcaster: req.chatBroadcaster,
  });

  res.status(201).json({
    success: true,
    message: "Group created successfully",
    ...result,
  });
});

// =====================================================
// GET MY GROUPS (Updated to use optimized Service)
// =====================================================

export const getMyGroups = asyncWrapper(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const groups = await groupService.getMyGroups({
    userId: req.user._id,
    page,
    limit,
  });

  res.set("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    page,
    count: groups.length,
    data: groups,
  });
});

// =====================================================
// GET GROUP OVERVIEW
// =====================================================

export const getGroupOverview = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const overview = await groupService.getGroupOverview({
    groupId,
    userId: req.user._id,
  });

  res.status(200).json({ success: true, data: overview });
});

// =====================================================
// UPDATE GROUP MEDIA
// =====================================================

export const updateGroupMedia = asyncWrapper(async (req, res) => {
  if (!req.files || (!req.files.avatar && !req.files.banner)) {
    throw new ValidationException("No files uploaded");
  }

  const user = req.user;
  const mediaResults = {};

  if (req.files.avatar) {
    const [avatarMedia] = await processUploadedMedia(
      req.files.avatar,
      "group-avatar",
      user,
      {
        resizeWidth: 1080,
        resizeHeight: 1080,
        minCount: 0,
      },
    );
    mediaResults.avatarMediaId = avatarMedia._id;
  }

  if (req.files.banner) {
    const [bannerMedia] = await processUploadedMedia(
      req.files.banner,
      "group-banner",
      user,
      {
        resizeWidth: 1920,
        resizeHeight: 600,
        minCount: 0,
      },
    );
    mediaResults.bannerMediaId = bannerMedia._id;
  }

  const group = await groupService.updateGroupMedia({
    groupId: req.params.groupId,
    userId: user._id,
    ...mediaResults,
  });

  res
    .status(200)
    .json({ success: true, message: "Group media updated", group });
});

// =====================================================
// REQUEST TO JOIN GROUP
// =====================================================

export const requestToJoinGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const result = await groupService.requestToJoinGroup({
    userId: req.user._id,
    groupId,
  });
  const isPending = result.status === "pending";

  res.status(isPending ? 202 : 200).json({
    success: true,
    message: isPending
      ? "Join request sent. Awaiting admin approval."
      : "Successfully joined the group",
    membership: result,
  });
});

// =====================================================
// JOIN GROUP BY INVITE
// =====================================================

export const joinGroupByInvite = asyncWrapper(async (req, res) => {
  const joined = await groupService.joinGroupByInvite(
    req.params.joinCode,
    req.user._id,
  );

  res.status(200).json({
    success: true,
    message: "Successfully joined the group",
    joined,
  });
});

// =====================================================
// LEAVE GROUP
// =====================================================

export const leaveGroup = asyncWrapper(async (req, res) => {
  await groupService.leaveGroup(req.user._id, req.params.groupId);

  res.status(200).json({ success: true, message: "You have left the group" });
});

// =====================================================
// APPROVE JOIN REQUEST
// =====================================================

export const approveJoinRequest = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const result = await groupService.approveGroupJoinRequest({
    adminId: req.user._id,
    groupId,
    targetUserId,
  });

  res
    .status(200)
    .json({
      success: true,
      message: "Join request approved",
      membership: result,
    });
});

// =====================================================
// REJECT JOIN REQUEST
// =====================================================

export const rejectJoinRequest = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  await groupService.rejectGroupJoinRequest({
    adminId: req.user._id,
    groupId,
    targetUserId,
  });

  res.status(200).json({ success: true, message: "Join request rejected" });
});

// =====================================================
// GET PENDING JOIN REQUESTS
// =====================================================

export const getPendingJoinRequests = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const requests = await membershipService.getPendingRequests({
    adminId: req.user._id,
    groupId,
  });

  res.status(200).json({ success: true, requests });
});

// =====================================================
// KICK USER
// =====================================================

export const kickUserFromGroup = asyncWrapper(async (req, res) => {
  await groupService.kickUserFromGroup({
    adminId: req.user._id,
    groupId: req.params.groupId,
    targetUserId: req.params.userId,
  });

  res
    .status(200)
    .json({ success: true, message: "User has been removed from the group" });
});

// =====================================================
// CHANGE MEMBER ROLE
// =====================================================

export const changeMemberRole = asyncWrapper(async (req, res) => {
  const updated = await groupService.changeMemberRole({
    adminId: req.user._id,
    groupId: req.params.groupId,
    targetUserId: req.params.userId,
    newRole: req.body.newRole,
  });

  res
    .status(200)
    .json({ success: true, message: "User role updated", updated });
});

// =====================================================
// GENERATE INVITE LINK
// =====================================================

export const generateInviteLink = asyncWrapper(async (req, res) => {
  const invite = await groupService.generateInviteLink({
    adminId: req.user._id,
    groupId: req.params.groupId,
  });

  res
    .status(200)
    .json({ success: true, invite, message: "Invite link generated" });
});

