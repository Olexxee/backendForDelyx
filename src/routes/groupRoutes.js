import { Router } from "express";
import {
  createGroup,
  searchGroupByName,
  generateInviteLink,
  joinGroupByInvite,
  getMyGroups,
  kickUserFromGroup,
  leaveGroup,
  changeMemberRole,
  updateGroupMedia,
  getGroupOverview,
  requestToJoinGroup,
  resolveJoinRequest,
  getPendingJoinRequests,
} from "../groupLogic/groupController.js";
import { getDiscoverGroups } from "../groupLogic/discoverGroupsController.js";
import { authMiddleware } from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";
import { handleMediaUpload } from "../middlewares/uploadMiddleware.js";

const groupRouter = Router();

// -----------------------
// GROUP ROUTES
// -----------------------

// Create a group
groupRouter.post(
  "/create",
  authMiddleware,
  handleMediaUpload("group"),
  createGroup,
);

// Get group by name
groupRouter.get("/name/:name", authMiddleware, searchGroupByName);

// Get all groups of the user
groupRouter.get("/my-groups", authMiddleware, getMyGroups);

// Discover groups based on activity
groupRouter.get("/discover", authMiddleware, getDiscoverGroups);

// Group overview (members, tournaments, pending count for admins)
groupRouter.get("/:groupId/overview", authMiddleware, getGroupOverview);

// Generate invite link (admin only)
groupRouter.get(
  "/:groupId/invite",
  authMiddleware,
  requireGroupAdmin,
  generateInviteLink,
);

// Join a group via invite link
groupRouter.post("/join/:joinCode", authMiddleware, joinGroupByInvite);

// -----------------------
// JOIN REQUESTS
// -----------------------

// Request to join a group (public = joins instantly, private = pending)
groupRouter.post("/:groupId/join-request", authMiddleware, requestToJoinGroup);

// Get all pending join requests (admin only)
groupRouter.get(
  "/:groupId/join-requests",
  authMiddleware,
  requireGroupAdmin,
  getPendingJoinRequests,
);

// Approve or reject a join request (admin only) — body: { action: "approve" | "reject" }
groupRouter.post(
  "/:groupId/join-requests/:userId",
  authMiddleware,
  requireGroupAdmin,
  resolveJoinRequest,
);

// -----------------------
// MEMBER MANAGEMENT (ADMIN)
// -----------------------

// Kick a user from group
groupRouter.post(
  "/:groupId/kick/:userId",
  authMiddleware,
  requireGroupAdmin,
  kickUserFromGroup,
);

// Change member role
groupRouter.post(
  "/:groupId/change-role/:userId",
  authMiddleware,
  requireGroupAdmin,
  changeMemberRole,
);

// Leave group
groupRouter.post("/:groupId/leave", authMiddleware, leaveGroup);

// -----------------------
// UPLOAD GROUP MEDIA
// -----------------------

groupRouter.post(
  "/:groupId/media",
  authMiddleware,
  requireGroupAdmin,
  handleMediaUpload("group"),
  updateGroupMedia,
);

export default groupRouter;
