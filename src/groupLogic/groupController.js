import * as groupService from "../groupLogic/groupService.js";
import { asyncWrapper } from "../lib/utils.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import { createGroupSchema } from "./groupRequestSchema.js";
import { processUploadedMedia } from "../middlewares/processUploadedImages.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";

const validator = new ValidatorClass();

// GET GROUP BY NAME
export const searchGroupByName = asyncWrapper(async (req, res) => {
  const { name } = req.params;
  const groups = await groupService.searchGroupsByName({ name });
  res.status(200).json({ success: true, groups });
});

// ==================================================
// CREATE GROUP
// ==================================================
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

  // 4️⃣ Delegate to service
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

export const getGroupOverview = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;

  const overview = await groupService.getGroupOverview({
    groupId,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    data: overview,
  });
});

// ==================================================
// UPDATE GROUP MEDIA (AVATAR/BANNER)
// ==================================================
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

  res.status(200).json({
    success: true,
    message: "Group media updated",
    group,
  });
});

// ==================================================
// JOIN GROUP
// ==================================================
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

// ==================================================
// LEAVE GROUP
// ==================================================
export const leaveGroup = asyncWrapper(async (req, res) => {
  await groupService.leaveGroup(req.user._id, req.params.groupId);

  res.status(200).json({
    success: true,
    message: "You have left the group",
  });
});

// ==================================================
// KICK USER
// ==================================================
export const kickUserFromGroup = asyncWrapper(async (req, res) => {
  await groupService.kickUserFromGroup({
    adminId: req.user._id,
    groupId: req.params.groupId,
    targetUserId: req.params.userId,
  });

  res.status(200).json({
    success: true,
    message: "User has been removed from the group",
  });
});

// ==================================================
// CHANGE MEMBER ROLE
// ==================================================
export const changeMemberRole = asyncWrapper(async (req, res) => {
  const updated = await groupService.changeMemberRole({
    adminId: req.user._id,
    groupId: req.params.groupId,
    targetUserId: req.params.userId,
    newRole: req.body.newRole,
  });

  res.status(200).json({
    success: true,
    message: "User role updated",
    updated,
  });
});

// ==================================================
// GENERATE INVITE LINK
// ==================================================
export const generateInviteLink = asyncWrapper(async (req, res) => {
  const invite = await groupService.generateInviteLink({
    adminId: req.user._id,
    groupId: req.params.groupId,
  });

  res.status(200).json({
    success: true,
    invite,
    message: "Invite link generated",
  });
});

// ==================================================
// REQUEST TO JOIN GROUP
// ==================================================
export const requestToJoinGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;

  console.log(`User ${req.user._id} is requesting to join group ${groupId}`);

  const result = await groupService.requestToJoinGroup({
    userId: req.user._id,
    groupId,
  });

  // Public group → joined immediately; private → pending
  const isPending = result.status === "pending";

  res.status(isPending ? 202 : 200).json({
    success: true,
    message: isPending
      ? "Join request sent. Awaiting admin approval."
      : "Successfully joined the group",
    membership: result,
  });
});

// ==================================================
// RESOLVE JOIN REQUEST (ADMIN: APPROVE / REJECT)
// ==================================================
export const resolveJoinRequest = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const { action } = req.body; // "approve" | "reject"

  const result = await groupService.resolveJoinRequest({
    adminId: req.user._id,
    groupId,
    targetUserId,
    action,
  });

  res.status(200).json({
    success: true,
    message: `Join request ${action}d`,
    result,
  });
});

// ==================================================
// GET PENDING JOIN REQUESTS (ADMIN)
// ==================================================
export const getPendingJoinRequests = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;

  const requests = await groupService.getPendingJoinRequests({
    adminId: req.user._id,
    groupId,
  });

  res.status(200).json({
    success: true,
    requests,
  });
});

export const getMyGroups = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  const groups = await groupService.getUserGroupsWithLastMessage({
    userId,
  });

  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    success: true,
    data: groups,
  });
});
