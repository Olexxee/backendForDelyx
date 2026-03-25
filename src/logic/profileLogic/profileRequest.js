import Joi from "joi";

const locationSchema = Joi.object({
  type: Joi.string().valid("Point").default("Point"),
  coordinates: Joi.array().items(Joi.number()).length(2).default([0, 0]),
  city: Joi.string().trim(),
  country: Joi.string().trim(),
  state: Joi.string().trim(),
  address: Joi.string().trim(),
});

const agePreferenceSchema = Joi.object({
  min: Joi.number().min(18).max(100).default(18),
  max: Joi.number().min(18).max(100).default(100),
});

const mediaItemSchema = Joi.object({
  url: Joi.string().uri().required(),
  type: Joi.string().valid("image", "video").default("image"),
  uploadedAt: Joi.date(),
});

const verificationBadgeSchema = Joi.object({
  type: Joi.string().valid("email", "phone", "photo", "identity"),
  verifiedAt: Joi.date(),
});

const premiumFeaturesSchema = Joi.object({
  profileBoosts: Joi.object({
    total: Joi.number().default(0),
    remaining: Joi.number().default(0),
    lastUsed: Joi.date(),
  }),
  superLikes: Joi.object({
    total: Joi.number().default(0),
    remaining: Joi.number().default(0),
    lastUsed: Joi.date(),
  }),
});

const matchingPreferencesSchema = Joi.object({
  maxDistance: Joi.number().default(50),
  hideProfile: Joi.boolean().default(false),
  showMeIn: Joi.string()
    .valid("discovery", "connections", "both")
    .default("both"),
});

const statsSchema = Joi.object({
  profileViews: Joi.number().default(0),
  connectionsSent: Joi.number().default(0),
  connectionsReceived: Joi.number().default(0),
  matches: Joi.number().default(0),
});

export const createProfileSchema = Joi.object({
  firstName: Joi.string().max(20),
  LastName: Joi.string().max(20),
  tribe: Joi.string(),
  bio: Joi.string().max(500),
  religion: Joi.string(),
  interests: Joi.array().items(Joi.string()),
  goals: Joi.array().items(Joi.string()),
  hobbies: Joi.array().items(Joi.string()),
  website: Joi.string().uri(),
  occupation: Joi.string(),
  education: Joi.string(),
  gender: Joi.string().valid("male", "female", "non-binary", "other"),
  lookingFor: Joi.string().valid("male", "female", "any"),
  dateOfBirth: Joi.date(),
  agePreference: agePreferenceSchema,
  location: locationSchema,
  origin: Joi.string().trim(),
  profilePicture: Joi.string().hex().length(24), // ObjectId
  mediaGallery: Joi.array().items(mediaItemSchema),
  visibility: Joi.string()
    .valid("public", "friends-only", "private")
    .default("public"),
  sexualPreference: Joi.string()
    .valid("heterosexual", "homosexual", "bisexual", "asexual", "other")
    .default("other"),
  blockedUsers: Joi.array().items(Joi.string().hex().length(24)), // ObjectId
  lastActive: Joi.date(),
  isOnline: Joi.boolean(),
  profileComplete: Joi.boolean(),
  isVerified: Joi.boolean(),
  verificationBadges: Joi.array().items(verificationBadgeSchema),
  matchingPreferences: matchingPreferencesSchema,
  premiumFeatures: premiumFeaturesSchema,
  stats: statsSchema,
});

export const updateProfileSchema = Joi.object({
  tribe: Joi.string(),
  bio: Joi.string().max(500),
  religion: Joi.string(),
  interests: Joi.array().items(Joi.string()),
  goals: Joi.array().items(Joi.string()),
  hobbies: Joi.array().items(Joi.string()),
  website: Joi.string().uri(),
  occupation: Joi.string(),
  education: Joi.string(),
  gender: Joi.string().valid("male", "female", "non-binary", "other"),
  lookingFor: Joi.string().valid("male", "female", "any"),
  dateOfBirth: Joi.date(),
  agePreference: agePreferenceSchema,
  location: locationSchema,
  origin: Joi.string().trim(),
  profilePicture: Joi.string().hex().length(24),
  mediaGallery: Joi.array().items(mediaItemSchema),
  visibility: Joi.string().valid("public", "friends-only", "private"),
  sexualPreference: Joi.string().valid(
    "heterosexual",
    "homosexual",
    "bisexual",
    "asexual",
    "other"
  ),
  blockedUsers: Joi.array().items(Joi.string().hex().length(24)),
  lastActive: Joi.date(),
  isOnline: Joi.boolean(),
  profileComplete: Joi.boolean(),
  isVerified: Joi.boolean(),
  verificationBadges: Joi.array().items(verificationBadgeSchema),
  matchingPreferences: matchingPreferencesSchema,
  premiumFeatures: premiumFeaturesSchema,
  stats: statsSchema,
}).min(1); // ensure at least one field is provided

export const updateVisibilitySchema = Joi.object({
  visibility: Joi.string()
    .valid("public", "friends-only", "private")
    .required(),
});
