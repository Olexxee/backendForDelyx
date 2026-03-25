import logger from "../../lib/logger.js";
import * as profileService from "./profileService.js";
import { asyncWrapper } from "../../lib/utils.js";
import { ValidationException, NotFoundException } from "../../lib/classes/errorClasses.js";
import jwtService from "../../lib/classes/jwtClass.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";
import {
  updateVisibilitySchema,
  updateProfileSchema,
} from "./profileRequest.js";
import User from "../../user/userSchema.js";

/**
 * GET /me/profile
 */
export const getUserProfile = asyncWrapper(async (req, res) => {
  const profile = await profileService.getProfile(req.user.id);
  res.status(200).json({ success: true, profile });
});

/**
 * POST /me/profile
 * For first-time profile creation with optional profile picture upload
 */
export const createProfile = asyncWrapper(async (req, res) => {
  let profilePicture = null;

  if (req.files && req.files.length > 0) {
    const mediaDocs = await processUploadedMedia(req, "profile", {
      resizeWidth: 500,
      resizeHeight: 500,
    });
    profilePicture = mediaDocs[0]?._id || null;
  }

  const profileData = { ...req.body, profilePicture };
  const newProfile = await profileService.createProfile(req.user.id, profileData);

  // Issue new token including profileId
  const newToken = jwtService.generateAuthenticationToken({
    id: req.user.id,
    email: req.user.email,
    profileId: newProfile._id,
  });

  res.status(201).json({
    success: true,
    message: "Profile created successfully",
    profile: newProfile,
    token: newToken,
  });
});

export const getProfilesController = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, city, country } = req.query;
  const currentUserId = req.user?.id;

  // Optional location filters
  // Support: city-only, country-only, or both
  const locationFilter = {};
  if (city) locationFilter.city = city;
  if (country) locationFilter.country = country;

  const { profiles, pagination } = await profileService.getProfilesBusinessCheck({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    currentUserId,
    locationFilter,
  });

  // Determine filter mode for response
  let filterMode = "default (same city & country)";
  if (city && country) {
    filterMode = `city: ${city}, country: ${country}`;
  } else if (city) {
    filterMode = `city: ${city}`;
  } else if (country) {
    filterMode = `country: ${country} (any city)`;
  }

  res.status(200).json({
    success: true,
    data: profiles,
    pagination,
    filters: {
      mode: filterMode,
      city: city || null,
      country: country || null
    }
  });
});

/**
 * PUT /me/profile/visibility
 */
export const setProfileVisibility = asyncWrapper(async (req, res) => {
  const { error, value } = updateVisibilitySchema.validate(req.body);
  if (error) throw new ValidationException(error.details);

  const updatedProfile = await profileService.updateProfileVisibility(
    req.user.id,
    value.visibility
  );

  res.status(200).json({
    success: true,
    message: `Profile visibility updated to ${value.visibility}`,
    profile: updatedProfile,
  });
});

/**
 * GET /profile/:idOrUsername
 */
export const viewUserProfile = asyncWrapper(async (req, res) => {
  const profile = await profileService.getUserProfileWithVisibility(
    req.user,
    req.params.idOrUsername
  );
  res.status(200).json({ success: true, profile });
});

/**
 * GET /profiles/search
 */
export const searchProfiles = asyncWrapper(async (req, res) => {
  const currentUserId = req.user?.id;
  const profiles = await profileService.searchProfiles(req.query, currentUserId);
  res.status(200).json({ success: true, profiles });
});

/**
 * GET /profiles/nearby
 * Returns nearby users filtered by location
 * 
 * Filtering modes:
 * - No params: Uses current user's city AND country (default)
 * - city only: Shows users in that city
 * - country only: Shows users in that country (any city)
 * - both: Shows users in that city AND country
 * 
 * Query params: lat, lng, distance (optional), city (optional), country (optional)
 */
export const findNearbyProfiles = asyncWrapper(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const distance = parseInt(req.query.distance, 10) || 10000;

  if (isNaN(lat) || isNaN(lng)) {
    throw new ValidationException("Invalid or missing latitude/longitude");
  }

  const currentUserId = req.user?.id;
  
  // Optional location filters
  const locationFilter = {};
  if (req.query.city) {
    locationFilter.city = req.query.city;
  }
  if (req.query.country) {
    locationFilter.country = req.query.country;
  }

  const profiles = await profileService.findNearbyProfiles([lng, lat], distance, currentUserId, locationFilter);
  
  // Determine filter mode for response
  let filterMode = "default (same city & country)";
  if (locationFilter.city && locationFilter.country) {
    filterMode = `city: ${locationFilter.city}, country: ${locationFilter.country}`;
  } else if (locationFilter.city) {
    filterMode = `city: ${locationFilter.city}`;
  } else if (locationFilter.country) {
    filterMode = `country: ${locationFilter.country} (any city)`;
  }
  
  res.status(200).json({ 
    success: true, 
    profiles,
    filters: {
      mode: filterMode,
      city: locationFilter.city || null,
      country: locationFilter.country || null
    }
  });
});

/**
 * GET /profiles/match-interests
 */
export const findProfilesByInterestMatch = asyncWrapper(async (req, res) => {
  const parsedInterests = req.query.interests
    ? req.query.interests.split(",")
    : [];
  const currentUserId = req.user?.id;
  const profiles = await profileService.findProfilesByInterestMatch(parsedInterests, currentUserId);
  res.status(200).json({ success: true, profiles });
});

/**
 * GET /profiles/recently-active
 * Returns recently active users filtered by location
 * 
 * Filtering modes:
 * - No params: Uses current user's city AND country (default)
 * - city only: Shows users in that city (ensures same country)
 * - country only: Shows users in that country (any city)
 * - both: Shows users in that city AND country
 * 
 * Query params: limit, city, country
 */
export const findRecentlyActiveProfiles = asyncWrapper(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const currentUserId = req.user?.id;
  
  // Optional location filters
  const locationFilter = {};
  if (req.query.city) {
    locationFilter.city = req.query.city;
  }
  if (req.query.country) {
    locationFilter.country = req.query.country;
  }

  const profiles = await profileService.findRecentlyActiveProfiles(limit, currentUserId, locationFilter);
  
  // Determine filter mode for response
  let filterMode = "default (same city & country)";
  if (locationFilter.city && locationFilter.country) {
    filterMode = `city: ${locationFilter.city}, country: ${locationFilter.country}`;
  } else if (locationFilter.city) {
    filterMode = `city: ${locationFilter.city}`;
  } else if (locationFilter.country) {
    filterMode = `country: ${locationFilter.country} (any city)`;
  }
  
  res.status(200).json({ 
    success: true, 
    profiles,
    filters: {
      mode: filterMode,
      city: locationFilter.city || null,
      country: locationFilter.country || null
    }
  });
});

/**
 * GET /profiles/random
 */
export const findRandomProfiles = asyncWrapper(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const profiles = await profileService.findRandomProfiles(limit, req.user.id);
  res.status(200).json({ success: true, profiles });
});

/**
 * PUT /me/profile
 */
export const updateProfile = asyncWrapper(async (req, res) => {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) throw new ValidationException(error.details);

  const updatedProfile = await profileService.updateProfile(req.user.id, value);
  res.status(200).json({ success: true, profile: updatedProfile });
});

/**
 * PUT /me/profile/picture
 * Accepts mediaId or uploaded file
 */
export const updateProfilePicture = asyncWrapper(async (req, res) => {
  let mediaId = req.body.mediaId || null;

  if (!mediaId && req.files && req.files.length > 0) {
    const mediaDocs = await processUploadedMedia(req, "profile", {
      resizeWidth: 500,
      resizeHeight: 500,
    });
    mediaId = mediaDocs[0]?._id;
  }

  if (!mediaId) throw new ValidationException("mediaId or file upload is required");

  const updatedProfile = await profileService.updateProfilePicture(req.user.id, mediaId);
  res.status(200).json({ success: true, message: "Profile picture updated", profile: updatedProfile });
});

/**
 * POST /me/profile/gallery
 * Accepts uploaded files or mediaIds in body
 */
export const addToGallery = asyncWrapper(async (req, res) => {
  let galleryItems = [];

  if (req.files && req.files.length > 0) {
    const mediaDocs = await processUploadedMedia(req, "profile", {
      resizeWidth: 800,
      resizeHeight: 800,
    });
    
    // Convert to gallery item objects with url, type, uploadedAt
    galleryItems.push(...mediaDocs.map((m, index) => {
      // Detect type from mimetype of original file
      const file = req.files[index];
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      return {
        url: m.url,
        type: mediaType,  // "image" or "video" based on file type
        uploadedAt: new Date()
      };
    }));
  }

  if (galleryItems.length === 0) {
    throw new ValidationException("You must upload files");
  }

  const updatedProfile = await profileService.addToGallery(req.user.id, galleryItems);
  res.status(200).json({ success: true, message: "Gallery updated", profile: updatedProfile });
});

/**
 * DELETE /me/gallery
 */
export const removeFromGallery = asyncWrapper(async (req, res) => {
  const { mediaUrl } = req.body;
  
  if (!mediaUrl) {
    throw new ValidationException("mediaUrl is required in request body");
  }
  
  const updatedProfile = await profileService.removeFromGallery(req.user.id, mediaUrl);
  res.status(200).json({ success: true, message: "Gallery item removed", profile: updatedProfile });
});

/**
 * POST /me/device-token
 * Register or update device token for push notifications
 */
export const registerDeviceToken = asyncWrapper(async (req, res) => {
  const { deviceToken } = req.body;
  const userId = req.user.id;

  if (!deviceToken) {
    throw new ValidationException("Device token is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundException("User not found");
  }

  // Add token to deviceTokens array if not already present
  if (!user.deviceTokens.includes(deviceToken)) {
    user.deviceTokens.push(deviceToken);
    await user.save();
    logger.info(`✅ Device token registered for user ${userId}`);
  } else {
    logger.info(`ℹ️ Device token already registered for user ${userId}`);
  }

  res.status(200).json({
    success: true,
    message: "Device token registered successfully",
    deviceToken,
  });
});

/**
 * DELETE /me/device-token
 * Remove device token (e.g., on logout)
 */
export const removeDeviceToken = asyncWrapper(async (req, res) => {
  const { deviceToken } = req.body;
  const userId = req.user.id;

  if (!deviceToken) {
    throw new ValidationException("Device token is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundException("User not found");
  }

  // Remove token from deviceTokens array
  const initialLength = user.deviceTokens.length;
  user.deviceTokens = user.deviceTokens.filter(token => token !== deviceToken);
  
  if (user.deviceTokens.length < initialLength) {
    await user.save();
    logger.info(`✅ Device token removed for user ${userId}`);
  } else {
    logger.info(`ℹ️ Device token not found for user ${userId}`);
  }

  res.status(200).json({
    success: true,
    message: "Device token removed successfully",
  });
});
