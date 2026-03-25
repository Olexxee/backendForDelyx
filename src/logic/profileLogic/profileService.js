import logger from "../../lib/logger.js";
import * as profileDB from "../../models/profileSchemaService.js";
import mediaService from "../../models/mediaSchemaService.js";
import { sendNotification } from "../notifications/notificationService.js";
import { NotificationTypes } from "../notifications/notificationTypes.js";
import * as userService from "../../user/userService.js";
import {
  NotFoundException,
  UnauthorizedException,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";
import { canViewProfile } from "../../lib/visibilityChecker.js";
import { enrichUserWithRoleAndVerification } from "../../lib/enrichUserData.js";
import { validateLocation } from "../../lib/validateLocation.js";
import * as gamificationService from "../gamification/gamificationService.js";

const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(value);

// -------------------- PROFILE CREATION -------------------- //

export const createProfile = async (userId, profileData) => {
  const existing = await profileDB.findProfileByUserId(userId);
  if (existing)
    throw new errorService.ConflictException(
      "Profile already exists for this user."
    );

  const user = await userService.findUserById(userId);
  if (!user) throw new errorService.NotFoundException("User not found");

  // Validate location if provided
  if (profileData.location) {
    const { country, city } = profileData.location;
    if (country) {
      await validateLocation(country, city || null);
    }
  }

  // Update the user's name
  const updates = {};
  if (profileData.firstName) updates.firstName = profileData.firstName;
  if (profileData.lastName) updates.lastName = profileData.lastName;

  await userService.findAndUpdateUserById(userId, updates);

  const profile = await profileDB.createProfile({
    user: userId,
    ...profileData,
  });

  // Send notification
  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_CREATED,
    title: "Your profile has been created",
    message: "Welcome! Your profile is now live.",
  });

  return profile;
};

//-------------- GET PROFILE-------------------//

export const getProfile = async (userId) => {
  const profile = await profileDB.findProfileByUserId(userId);
  if (!profile) throw new NotFoundException("Profile not found");
  
  // Award daily open bonus (if not already claimed today)
  setImmediate(() => gamificationService.awardDailyOpen(userId));
  
  // Get gamification stats
  const gamificationStats = await gamificationService.getUserGamificationStats(userId);
  const unlocks = await gamificationService.getUserUnlocks(userId);
  
  // Get user's asks
  const Ask = (await import("../../models/askSchema.js")).default;
  const userAsks = await Ask.find({ author: userId })
    .select("_id content category createdAt helpfulCount favoritesCount")
    .sort({ createdAt: -1 })
    .lean();
  
  // Get user's events
  const Event = (await import("../../models/eventSchema.js")).default;
  const userEvents = await Event.find({ createdBy: userId })
    .select("_id title description eventDate createdAt category")
    .sort({ createdAt: -1 })
    .lean();
  
  // Get user's stores/marts with catalogs
  const Store = (await import("../../models/storeSchema.js")).default;
  const Catalog = (await import("../../models/catalogSchema.js")).default;
  const storesRaw = await Store.find({ owner: userId, isActive: true })
    .select("_id name description createdAt image thumbnail storeType location contact")
    .sort({ createdAt: -1 })
    .lean();
  
  // Populate catalogs for each store
  const userStores = await Promise.all(
    storesRaw.map(async (store) => {
      const catalogs = await Catalog.find({ store: store._id })
        .select("_id name description price type images thumbnail createdAt")
        .sort({ createdAt: -1 })
        .lean();
      return {
        ...store,
        catalogs,
      };
    })
  );
  
  // Get user's favorites with post details
  const { Favorite } = await import("../../models/FavoriteShema.js");
  const { hydrateFavorite } = await import("../bookmark/hydrateFavorite.js");
  const favoritesRaw = await Favorite.find({ userId })
    .select("_id postId postType createdAt")
    .sort({ createdAt: -1 })
    .limit(50) // Limit to recent 50 favorites
    .lean();
  
  // Hydrate favorites with post details (await properly)
  const userFavorites = await Promise.all(
    favoritesRaw.map(async (fav) => await hydrateFavorite(fav))
  );
  
  // Filter out null favorites (deleted posts)
  const validFavorites = userFavorites.filter(Boolean);
  
  // Enrich Ask posts in favorites with author profile data
  const enrichedFavorites = await Promise.all(
    validFavorites.map(async (fav) => {
      if (fav.post && fav.postType === "ask" && fav.post.author && fav.post.author._id) {
        // Enrich ask author with profile data
        const askAuthorProfile = await profileDb.findProfileByUserId(fav.post.author._id);
        if (askAuthorProfile) {
          const { enrichUserWithRoleAndVerification } = await import("../../lib/enrichUserData.js");
          const enrichedUser = enrichUserWithRoleAndVerification(fav.post.author, askAuthorProfile);
          fav.post.author = {
            ...enrichedUser,
            profileId: askAuthorProfile._id,
            firstName: askAuthorProfile.firstName,
            lastName: askAuthorProfile.lastName,
            displayName: askAuthorProfile.displayName,
            profilePicture: askAuthorProfile.profilePicture,
          };
        }
      }
      return fav;
    })
  );
  
  // Get total connections count (accepted connections only)
  const Connection = (await import("../../models/connectionSchema.js")).default;
  const connectionsCount = await Connection.countDocuments({
    $or: [
      { senderProfile: profile._id, status: "accepted" },
      { recipientProfile: profile._id, status: "accepted" },
    ],
  });
  
  // Enrich profile with gamification and user content
  const profileObj = profile.toObject ? profile.toObject() : profile;
  
  return {
    ...profileObj,
    gamification: {
      totalPoints: gamificationStats.totalPoints,
      level: gamificationStats.level,
      levelName: gamificationStats.levelName,
      dailyPoints: gamificationStats.dailyPoints,
      pointsBreakdown: gamificationStats.pointsBreakdown,
      cityRanking: gamificationStats.cityRanking,
      unlocks: unlocks.unlocks,
    },
    content: {
      asks: userAsks,
      events: userEvents,
      stores: userStores,
      favorites: enrichedFavorites,
    },
    stats: {
      totalConnections: connectionsCount,
      totalAsks: userAsks.length,
      totalEvents: userEvents.length,
      totalStores: userStores.length,
      totalFavorites: validFavorites.length,
    },
  };
};
// -------------------- VIEW USER PROFILE WITH VISIBILITY -------------------- //

export const getUserProfileWithVisibility = async (currentUser, idOrUsername) => {
  let profile;

  // Try to find profile by ID first (if valid ObjectId format)
  if (isObjectId(idOrUsername)) {
    profile = await profileDB.getProfileWithUser(idOrUsername);
  }

  // If not found by ID, try to find by displayName
  if (!profile) {
    const Profile = (await import("../../models/profileSchema.js")).default;
    profile = await Profile.findOne({ displayName: idOrUsername }).populate(
      "user",
      "-password -resetToken -__v"
    );
  }

  // Profile not found
  if (!profile) {
    throw new NotFoundException(
      `Profile not found with ID or username: ${idOrUsername}`
    );
  }

    // Get current user's full data
    const viewer = await userService.findUserById(currentUser.id);
    if (!viewer) {
      throw new UnauthorizedException("Viewer not authenticated");
    }
  
    // Check if viewer can see this profile
    // Pass the profile object instead of just profile.user
    const canView = canViewProfile(viewer, profile);
    
    if (!canView) {
      throw new ForbiddenError(
        "You do not have permission to view this profile"
      );
    }
  
    // Check if either user has blocked the other
    if (
      profile.blockedUsers?.includes(viewer._id) ||
      viewer.blockedUsers?.includes(profile.user._id)
    ) {
      throw new ForbiddenError("This profile is not accessible");
    }

  // Check if either user has blocked the other
  if (
    profile.blockedUsers?.includes(viewer._id) ||
    viewer.blockedUsers?.includes(profile.user._id)
  ) {
    throw new ForbiddenError("This profile is not accessible");
  }

  // Increment profile view count (async, don't wait)
  profileDB.updateProfileByUserId(profile.user._id, {
    $inc: { "stats.profileViews": 1 },
  }).catch((err) => logger.warn("Failed to increment profile views:", err.message));

  // Remove sensitive data before returning
  const profileData = profile.toObject ? profile.toObject() : { ...profile };
  
  // Remove blocked users list for privacy
  delete profileData.blockedUsers;
  
  // Enrich user data with role and verification status
  if (profileData.user) {
    profileData.user = enrichUserWithRoleAndVerification(
      profileData.user,
      profileData
    );
  }
  
  // Return profile with user data
  return profileData;
};

//----------------FETCH PROFILES------------------//

export const getProfilesBusinessCheck = async ({
  page = 1,
  limit = 20,
  currentUserId,
  locationFilter = {},
}) => {
  const filter = {
    visibility: { $ne: "private" }, // Only show visible profiles
  };

  // exclude the current user
  if (currentUserId) {
    filter.user = { $ne: currentUserId };
    
    // Get current user's profile to enforce location-based filtering
    const currentProfile = await profileDB.findProfileByUserId(currentUserId);
    if (currentProfile) {
      // Apply location filters
      // Support three modes:
      // 1. city only: Filter by city
      // 2. country only: Filter by country (any city in that country)
      // 3. both: Filter by city AND country
      // 4. neither: Default to current user's city AND country
      
      if (locationFilter.city) {
        filter["location.city"] = locationFilter.city;
      } else if (!locationFilter.country && currentProfile.location?.city) {
        // Default: use current user's city if no explicit filters
        filter["location.city"] = currentProfile.location.city;
      }
      
      if (locationFilter.country) {
        filter["location.country"] = locationFilter.country;
      } else if (!locationFilter.city && currentProfile.location?.country) {
        // Default: use current user's country if no explicit filters
        filter["location.country"] = currentProfile.location.country;
      }
    }
  } else {
    // If no currentUserId but location filters provided, use them
    if (locationFilter.city) {
      filter["location.city"] = locationFilter.city;
    }
    if (locationFilter.country) {
      filter["location.country"] = locationFilter.country;
    }
  }

  const { profiles, pagination } = await profileDB.getProfilesFromDb(
    filter,
    page,
    limit
  );

  if (!profiles || profiles.length === 0) {
    throw new NotFoundException("No profiles found in your location");
  }

  return { profiles, pagination };
};

// -------------------- SEARCH & DISCOVERY -------------------- //

export const findRecentlyActiveProfiles = async (limit = 20, currentUserId = null, locationFilter = {}) => {
  // Get current user's profile to enforce location-based filtering
  // Only apply default location if no explicit filters provided
  if (currentUserId && !locationFilter.city && !locationFilter.country) {
    const currentProfile = await profileDB.findProfileByUserId(currentUserId);
    if (!currentProfile) {
      throw new NotFoundException("Your profile not found. Please create a profile first.");
    }

    // Default: use current user's city and country
    if (currentProfile.location?.city) {
      locationFilter.city = currentProfile.location.city;
    }
    if (currentProfile.location?.country) {
      locationFilter.country = currentProfile.location.country;
    }
  }

  const profiles = await profileDB.findRecentlyActiveProfiles(limit, currentUserId, locationFilter);
  if (!profiles || profiles.length === 0) {
    const locationDesc = locationFilter.country && !locationFilter.city 
      ? `in ${locationFilter.country}` 
      : "in your location";
    throw new NotFoundException(`No recently active profiles found ${locationDesc}`);
  }
  return profiles;
};

export const searchProfiles = async (query, currentUserId = null) => {
  const profiles = await profileDB.searchProfiles(query, currentUserId);
  if (!profiles || profiles.length === 0) {
    throw new NotFoundException("No profiles found matching your search");
  }
  return profiles;
};

export const findNearbyProfiles = async (coordinates, distance, currentUserId = null, locationFilter = {}) => {
  // Get current user's profile to enforce location-based filtering
  // Only apply default location if no explicit filters provided
  if (currentUserId && !locationFilter.city && !locationFilter.country) {
    const currentProfile = await profileDB.findProfileByUserId(currentUserId);
    if (!currentProfile) {
      throw new NotFoundException("Your profile not found. Please create a profile first.");
    }

    // Default: use current user's city and country
    if (currentProfile.location?.city) {
      locationFilter.city = currentProfile.location.city;
    }
    if (currentProfile.location?.country) {
      locationFilter.country = currentProfile.location.country;
    }
  }

  const profiles = await profileDB.findNearbyProfiles(coordinates, distance, currentUserId, locationFilter);
  if (!profiles || profiles.length === 0) {
    const locationDesc = locationFilter.country && !locationFilter.city 
      ? `in ${locationFilter.country}` 
      : "in your location";
    throw new NotFoundException(`No nearby profiles found ${locationDesc}`);
  }
  return profiles;
};

export const findProfilesByInterestMatch = async (interests, currentUserId = null) => {
  const profiles = await profileDB.findProfilesByInterestMatch(interests, currentUserId);
  if (!profiles || profiles.length === 0) {
    throw new NotFoundException("No profiles found with matching interests");
  }
  return profiles;
};

export const findRandomProfiles = async (limit, currentUserId) => {
  const profiles = await profileDB.findRandomProfiles(limit, currentUserId);
  if (!profiles || profiles.length === 0) {
    throw new NotFoundException("No profiles available");
  }
  return profiles;
};

// -------------------- PROFILE UPDATES -------------------- //

export const updateProfile = async (userId, updates) => {
  const profile = await profileDB.findProfileByUserId(userId);
  if (!profile) throw new NotFoundException("Profile not found");

  if (profile.user.toString() !== userId.toString()) {
    throw new UnauthorizedException(
      "You are not allowed to update this profile"
    );
  }

  const allowedFields = [
    "bio",
    "interests",
    "visibility",
    "location",
    "profilePicture",
    "mediaGallery",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      profile[field] = updates[field];
    }
  }

  await profile.save();

  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_UPDATED,
    title: "Profile updated",
    message: "Your profile details have been updated successfully.",
  });

  return profile;
};

export const updateProfilePicture = async (userId, mediaId) => {
  const profile = await profileDB.findProfileByUserId(userId);
  if (!profile) throw new NotFoundException("Profile not found");
  if (profile.user.toString() !== userId.toString()) {
    throw new UnauthorizedException("Not your profile");
  }

  if (profile.profilePicture) {
    await mediaService.deleteMediaById(profile.profilePicture);
  }

  profile.profilePicture = mediaId;
  await profile.save();

  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_PICTURE_UPDATED,
    title: "Profile picture updated 📸",
    message: "Your new profile picture is now live.",
  });

  return profile;
};

export const updateProfileVisibility = async (userId, visibility) => {
  const updated = await profileDB.updateProfileByUserId(userId, { visibility });
  if (!updated) throw new NotFoundException("Profile not found");

  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_VISIBILITY_CHANGED,
    title: "Profile visibility changed 👀",
    message: `Your profile visibility is now set to: ${visibility}.`,
  });

  return updated;
};

// -------------------- GALLERY MANAGEMENT -------------------- //

export const addToGallery = async (userId, galleryItems) => {
  const profile = await profileDB.findProfileByUserId(userId);
  if (!profile) throw new NotFoundException("Profile not found");
  if (profile.user.toString() !== userId.toString()) {
    throw new UnauthorizedException("Not your profile");
  }

  // Filter out duplicates by URL
  const existingUrls = profile.mediaGallery.map(item => item.url);
  const newItems = galleryItems.filter(
    item => !existingUrls.includes(item.url)
  );

  if (newItems.length === 0) return profile; // nothing to add

  profile.mediaGallery.push(...newItems);
  await profile.save();

  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_GALLERY_UPDATED,
    title: "Gallery updated",
    message: `${newItems.length} new item(s) were added to your gallery.`,
  });

  return profile;
};

export const removeFromGallery = async (userId, mediaUrl) => {
  const profile = await profileDB.findProfileByUserId(userId);
  if (!profile) throw new NotFoundException("Profile not found");
  if (profile.user.toString() !== userId.toString()) {
    throw new UnauthorizedException("Not your profile");
  }

  // Remove by URL
  const initialLength = profile.mediaGallery.length;
  profile.mediaGallery = profile.mediaGallery.filter(
    (item) => item.url !== mediaUrl
  );

  if (profile.mediaGallery.length === initialLength) {
    throw new NotFoundException("Gallery item not found");
  }

  // Try to delete the Media document and Firebase file
  const Media = (await import("../../models/mediaSchema.js")).default;
  const mediaDoc = await Media.findOne({ url: mediaUrl });
  if (mediaDoc) {
    await mediaService.deleteMediaById(mediaDoc._id);
  }

  await profile.save();

  await sendNotification({
    recipient: userId,
    type: NotificationTypes.PROFILE_GALLERY_UPDATED,
    title: "Gallery updated",
    message: "An item was removed from your gallery.",
  });

  return profile;
};

export const getIncompleteProfiles = async ({
  minDays = 2,
  threshold = 50,
} = {}) => {
  const cutoffDate = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);

  const users = await userService.findAllUsers({
    createdAt: { $lte: cutoffDate },
  });

  const processedUsers = users.map((user) => {
    const completion = profileDB.calculateProfileCompletion(user);
    return { ...user.toObject(), profileCompletion: completion };
  });

  return processedUsers.filter((user) => user.profileCompletion < threshold);
};
