import Profile from "./profileSchema.js";
import mongoose from "mongoose";

// Create profile
export const createProfile = (data) => Profile.create(data);

// Find profile by user ID
export const findProfileByUserId = (userId) =>
  Profile.findOne({ user: userId }).populate("user", "email username");

// Update profile by user ID
export const updateProfileByUserId = (userId, updateData) =>
  Profile.findOneAndUpdate({ user: userId }, updateData, {
    new: true,
    runValidators: true,
  });

 export const getProfilesFromDb = async (filter = {}, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find(filter).skip(skip).limit(limit).lean(),
    Profile.countDocuments(filter),
  ]);

  return {
    profiles,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getProfileWithUser = async (profileId) => {
  return Profile.findById(profileId).populate(
    "user",
    "-password -resetToken -__v"
  );
};

// Aggregate profiles
export const aggregateProfiles = (pipeline) => Profile.aggregate(pipeline);

// Search profiles with query object
export const searchProfiles = (query, currentUserId = null, options = {}) => {
  if (currentUserId) {
    query.user = { $ne: currentUserId };
  }
  return Profile.find(query, null, options);
};

// Find nearby profiles with location-based filtering
// Supports city-only, country-only, or both filters
export const findNearbyProfiles = async (coordinates, maxDistance = 10000, currentUserId = null, locationFilter = {}) => {
  const query = {
    visibility: { $ne: "private" }, // Only show visible profiles
    location: {
      $near: {
        $geometry: { type: "Point", coordinates },
        $maxDistance: maxDistance,
      },
    },
  };

  if (currentUserId) {
    query.user = { $ne: currentUserId };
  }

  // Location-based filtering
  // Support three modes:
  // 1. City only: Filter by city
  // 2. Country only: Filter by country (any city in that country)
  // 3. Both: Filter by city AND country
  
  if (locationFilter.city) {
    query["location.city"] = locationFilter.city;
  }
  
  if (locationFilter.country) {
    query["location.country"] = locationFilter.country;
  }

  // If no location filter provided but currentUserId exists, get current user's location
  // Default behavior: filter by same city (most restrictive)
  if (currentUserId && !locationFilter.city && !locationFilter.country) {
    const currentProfile = await Profile.findOne({ user: currentUserId })
      .select("location.city location.country")
      .lean();
    
    if (currentProfile?.location?.city) {
      query["location.city"] = currentProfile.location.city;
    }
    if (currentProfile?.location?.country) {
      query["location.country"] = currentProfile.location.country;
    }
  }

  return Profile.find(query)
    .select('user goals hobbies location interests firstName lastName displayName profilePicture lastActive isVerified verificationBadges createdAt updatedAt')
    .sort({ lastActive: -1 });
};

// Find profiles by interests
// Find profiles by interests
export const findProfilesByInterestMatch = (interests, currentUserId = null) => {
  const query = { interests: { $in: interests } };
  if (currentUserId) {
    query.user = { $ne: currentUserId };
  }
  return Profile.find(query);
};


// Recently active profiles based on last sign in (only completed profiles)
// Filters by location: supports city-only, country-only, or both
export const findRecentlyActiveProfiles = async (limit = 20, currentUserId = null, locationFilter = {}) => {
  // Calculate date 5 days ago
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const query = {
    lastActive: { $gte: fiveDaysAgo },
    visibility: { $ne: "private" }, // Only show visible profiles
  };

  // Exclude current user if provided
  if (currentUserId) {
    query.user = { $ne: currentUserId };
  }

  // Location-based filtering
  // Support three modes:
  // 1. City only: Filter by city (will also ensure same country)
  // 2. Country only: Filter by country (any city in that country)
  // 3. Both: Filter by city AND country
  
  if (locationFilter.city) {
    query["location.city"] = locationFilter.city;
  }
  
  if (locationFilter.country) {
    query["location.country"] = locationFilter.country;
  }

  // If no location filter provided but currentUserId exists, get current user's location
  // Default behavior: filter by same city (most restrictive)
  if (currentUserId && !locationFilter.city && !locationFilter.country) {
    const currentProfile = await Profile.findOne({ user: currentUserId })
      .select("location.city location.country")
      .lean();
    
    if (currentProfile?.location?.city) {
      query["location.city"] = currentProfile.location.city;
    }
    if (currentProfile?.location?.country) {
      query["location.country"] = currentProfile.location.country;
    }
  }

  return Profile.find(query)
    .select('user goals hobbies location interests firstName lastName displayName profilePicture lastActive isVerified verificationBadges createdAt updatedAt')
    .sort({ lastActive: -1 })
    .limit(limit)
    .lean();
};

// Random profiles for recommendations
export const findRandomProfiles = (limit = 10, currentUserId) =>
  Profile.aggregate([
    { $match: { user: { $ne: new mongoose.Types.ObjectId(currentUserId) } } },
    { $sample: { size: limit } },
    {
      $project: {
        username: 1,
        bio: 1,
        interests: 1,
        gender: 1,
        profilePicture: 1,
        mediaGallery: 1,
      },
    },
  ]);

  export const calculateProfileCompletion = (profileId) => {
    if (!profile) return 0;

    const requiredFields = [
      "firstName",
      "lastName",
      "bio",
      "profilePicture",
      "interests",
      "location",
    ];

    let filled = 0;
    for (const field of requiredFields) {
      const value = profile[field];

      if (Array.isArray(value)) {
        if (value.length > 0) filled++;
      } else if (value) {
        filled++;
      }
    }

    return Math.round((filled / requiredFields.length) * 100);
  };

// Update lastActive timestamp for a user's profile
export const updateLastActive = async (userId) => {
  return Profile.findOneAndUpdate(
    { user: userId },
    { lastActive: new Date() },
    { new: true }
  );
};