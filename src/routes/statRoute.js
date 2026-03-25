import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin, requirePlatformGroupAdmin, requireSuperAdmin } from "../admin/adminMiddleware.js";
import {
  getStats,
  getAllStatsForUser,
  patchStats,
  getGroupLeaderboard,
  recalculateRankings,
  incrementStats
} from "../userStatLogic/userStatController.js";

statRoute = Router();

// Create or get stats for a user in a group
statRoute.post("/:groupId/:userId", authMiddleware, requireGroupAdmin, createStats);

// Get stats for a specific user in a group
statRoute.get("/:groupId/:userId", authMiddleware, getStats);

// Get all stats for current user across all groups
statRoute.get("/all", authMiddleware, requireSuperAdmin, getAllStatsForUser);

// Update a user's stats in a group (e.g. wins, points)
statRoute.patch("/:groupId/:userId", authMiddleware, requireGroupAdmin, patchStats);

// Get group leaderboard (top users by score)
statRoute.get("/leaderboard/:groupId", authMiddleware, getGroupLeaderboard);

// Recalculate rankings for a group
statRoute.post("/recalculate/:groupId", authMiddleware,  recalculateRankings);

// Increment stats (e.g. score, wins)
statRoute.patch("/increment/:groupId/:userId", authMiddleware, requireGroupAdmin, incrementStats);

