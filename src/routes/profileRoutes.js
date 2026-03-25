import logger from "../../lib/logger.js";
import { Router } from "express";
import * as profileController from "../../logic/profileLogic/profileController.js";
import {
  createProfileSchema,
  updateVisibilitySchema,
} from "../../logic/profileLogic/profileRequest.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";
import { validateBody } from "../../middlewares/validatorMiddleware.js";
import { handleMediaUpload } from "../../middlewares/uploadMiddleware.js";

const profileRouter = Router();

/**
 * Middleware: parse JSON fields from form-data
 */
const parseJSONFields =
  (fields = []) =>
  (req, res, next) => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch {
          return res
            .status(400)
            .json({ success: false, message: `Invalid JSON for ${field}` });
        }
      }
    }
    next();
  };

/**
 * Middleware: require at least one uploaded file
 */
const requireFiles =
  (fieldName = "images") =>
  (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: `At least one ${fieldName} is required.`,
      });
    }
    next();
  };

/**
 * Create new profile with mandatory profile picture
 */
profileRouter.post(
  "/me",
  authMiddleware,
  handleMediaUpload("profile"),
  requireFiles("images"),
  parseJSONFields(["location", "interests"]), // parse stringified JSON
  validateBody(createProfileSchema), // Joi validation
  profileController.createProfile // controller
);

// Get current user's profile
profileRouter.get("/me", authMiddleware, profileController.getUserProfile);

// Get paginated list of profiles (excluding current user)
profileRouter.get("/", authMiddleware, profileController.getProfilesController);

// Update profile visibility
profileRouter.patch(
  "/me/visibility",
  authMiddleware,
  validateBody(updateVisibilitySchema),
  profileController.setProfileVisibility
);

// Advanced search
profileRouter.get(
  "/search/advanced",
  authMiddleware,
  profileController.searchProfiles
);

// Nearby search
profileRouter.get(
  "/search/nearby",
  authMiddleware,
  profileController.findNearbyProfiles
);

// Interest-based search
profileRouter.get(
  "/search/interests",
  authMiddleware,
  profileController.findProfilesByInterestMatch
);

// Update profile
profileRouter.put("/:id", authMiddleware, profileController.updateProfile);

// Recently active users
profileRouter.get(
  "/search/recently-active",
  authMiddleware,
  profileController.findRecentlyActiveProfiles
);

// Random profiles
profileRouter.get(
  "/search/random",
  authMiddleware,
  profileController.findRandomProfiles
);

// View profile by ID or username
profileRouter.get(
  "/:idOrUsername",
  authMiddleware,
  profileController.viewUserProfile
);

// Add media to gallery
profileRouter.post(
  "/me/gallery",
  authMiddleware,
  handleMediaUpload("profile"),
  requireFiles("images"),
  profileController.addToGallery
);

// Remove media from gallery
profileRouter.delete(
  "/me/gallery",
  authMiddleware,
  profileController.removeFromGallery
);

// Register device token for push notifications
profileRouter.post(
  "/me/device-token",
  authMiddleware,
  profileController.registerDeviceToken
);

// Remove device token (e.g., on logout)
profileRouter.delete(
  "/me/device-token",
  authMiddleware,
  profileController.removeDeviceToken
);

export default profileRouter;
