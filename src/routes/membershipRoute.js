import { Router } from "express";
import {
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getUserGroups,
  updateMembership,
  banUser,
} from "../groupLogic/membershipController.js";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import {
  requireGroupAdmin,
  requirePlatformGroupAdmin,
} from "../admin/adminMiddleware.js";

const membershipRouter = Router();

// Fetch all groups the logged-in user belongs to
membershipRouter.get("/my-groups", authMiddleware, getUserGroups);

// Join or leave a group
membershipRouter.post("/:groupId/join", authMiddleware, joinGroup);
// membershipRouter.post("/:groupId/leave", authMiddleware, leaveGroup); // already have a working controller

// Group membership management
membershipRouter.get(
  "/:groupId/members",
  authMiddleware,
  requireGroupAdmin,
  getGroupMembers
);

membershipRouter.patch(
  "/:groupId/membership/:userId",
  authMiddleware,
  requireGroupAdmin,
  updateMembership
);

membershipRouter.post(
  "/:groupId/ban/:userId",
  authMiddleware,
  requireGroupAdmin,
  banUser
);

export default membershipRouter;
