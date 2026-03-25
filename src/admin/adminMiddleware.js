import { ForbiddenError } from "../lib/classes/errorClasses.js";
import * as membershipService from "../groupLogic/membershipService.js";
import { asyncWrapper } from "../lib/utils.js";

// For platform-level superadmin only
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    throw new ForbiddenError("Only superadmin allowed");
  }
  next();
};

// For platform-level group admins or superadmin
export const requirePlatformGroupAdmin = (req, res, next) => {
  const allowed = ["groupAdmin", "superadmin"];
  if (!allowed.includes(req.user?.role)) {
    throw new ForbiddenError("Only group admins or superadmin allowed");
  }
  next();
};

export const requireGroupAdmin = asyncWrapper(async (req, res, next) => {
  const groupId = req.params.groupId;
  const userId = req.user._id;
  console.log("Checking group admin for userId:", userId, "groupId:", groupId);
  await membershipService.assertIsAdmin({ userId, groupId });
  next();
});
