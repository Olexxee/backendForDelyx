import logger from "../lib/logger.js";
import { Schema, model } from "mongoose";

const ProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Basic Info
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    displayName: { type: String, trim: true }, // What shows publicly
    // Core profile details
    tribe: { type: String },
    bio: { type: String, maxlength: 500 },
    religion: { type: String },
    interests: [String],
    goals: [String],
    hobbies: [String],
    website: { type: String },
    occupation: { type: String },
    education: { type: String },
    gender: { type: String, enum: ["male", "female", "non-binary", "other"] },
    lookingFor: { type: String, enum: ["male", "female", "any"] },

    // UPDATED: Changed from birthDate to dateOfBirth for consistency with connection service
    dateOfBirth: { type: Date},

    // ADDED: Age preferences for matching
    agePreference: {
      min: { type: Number, min: 18, max: 100, default: 18 },
      max: { type: Number, min: 18, max: 100, default: 100 },
    },

    // UPDATED: Enhanced location with city/country for search
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      city: { type: String, trim: true }, // ADDED: City name
      country: { type: String, trim: true }, // ADDED: Country
      state: { type: String, trim: true }, // ADDED: State/region (optional)
      address: { type: String, trim: true }, // ADDED: Full address (optional)
    },

    // ADDED: Origin/ethnicity for premium search filters
    origin: { type: String, trim: true },

    // Media
    profilePicture: { 
      type: String,  // Store URL directly
      trim: true
    },
    mediaGallery: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], default: "image" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Privacy
    visibility: {
      type: String,
      enum: ["public", "friends-only", "private"],
      default: "public",
    },

    sexualPreference: {
      type: String,
      enum: ["heterosexual", "homosexual", "bisexual", "asexual", "other"],
      default: "other",
    },

    // Blocking
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // ADDED: Activity tracking for better matching
    lastActive: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },

    // ADDED: Profile completion and verification
    profileComplete: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verificationBadges: [
      {
        type: { type: String, enum: ["email", "phone", "photo", "identity"] },
        verifiedAt: { type: Date, default: Date.now },
      },
    ],

    // ADDED: Matching preferences
    matchingPreferences: {
      maxDistance: { type: Number, default: 50 }, // km radius
      hideProfile: { type: Boolean, default: false }, // Hide from discovery
      showMeIn: {
        type: String,
        enum: ["discovery", "connections", "both"],
        default: "both",
      },
    },

    // ADDED: Premium features usage tracking
    premiumFeatures: {
      profileBoosts: {
        total: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
        lastUsed: { type: Date },
      },
      superLikes: {
        total: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
        lastUsed: { type: Date },
      },
    },

    // ADDED: Profile statistics
    stats: {
      profileViews: { type: Number, default: 0 },
      connectionsSent: { type: Number, default: 0 },
      connectionsReceived: { type: Number, default: 0 },
      matches: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    // ADDED: Better indexing strategy
    collection: "profiles",
  }
);

// UPDATED: Enhanced indexes for better performance
ProfileSchema.index({ location: "2dsphere" });
ProfileSchema.index({ user: 1 }, { unique: true });
ProfileSchema.index({ "location.city": 1, "location.country": 1 });
ProfileSchema.index({ gender: 1, lookingFor: 1 });
ProfileSchema.index({ dateOfBirth: 1 });
ProfileSchema.index({ interests: 1 });
ProfileSchema.index({ origin: 1 });
ProfileSchema.index({ lastActive: -1 });
ProfileSchema.index({ displayName: 1 }, { unique: true, sparse: true });
ProfileSchema.index({ visibility: 1, isOnline: -1 });

// ADDED: Compound indexes for common queries
ProfileSchema.index({
  visibility: 1,
  gender: 1,
  "location.city": 1,
  lastActive: -1,
});

ProfileSchema.index({
  visibility: 1,
  dateOfBirth: 1,
  gender: 1,
  lastActive: -1,
});

// ADDED: Virtual for calculating age
ProfileSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
});

// ADDED: Method to check if profile is complete
ProfileSchema.methods.isProfileComplete = function () {
  const requiredFields = [
    "dateOfBirth",
    "gender",
    "bio",
    "location.city",
    "location.country",
    "profilePicture",
  ];

  return requiredFields.every((field) => {
    const value = field.split(".").reduce((obj, key) => obj?.[key], this);
    return value !== null && value !== undefined && value !== "";
  });
};

// ADDED: Method to update last active
ProfileSchema.methods.updateLastActive = function () {
  this.lastActive = new Date();
  this.isOnline = true;
  return this.save();
};

// ADDED: Method to check age compatibility
ProfileSchema.methods.isAgeCompatible = function (otherProfile) {
  const myAge = this.age;
  const theirAge = otherProfile.age;

  if (!myAge || !theirAge) return false;

  const myMinAge = this.agePreference?.min || 18;
  const myMaxAge = this.agePreference?.max || 100;
  const theirMinAge = otherProfile.agePreference?.min || 18;
  const theirMaxAge = otherProfile.agePreference?.max || 100;

  return (
    theirAge >= myMinAge &&
    theirAge <= myMaxAge &&
    myAge >= theirMinAge &&
    myAge <= theirMaxAge
  );
};

// ADDED: Pre-save middleware to update profileComplete
ProfileSchema.pre("save", function (next) {
  this.profileComplete = this.isProfileComplete();
  next();
});

// ADDED: Static method for search with aggregation
ProfileSchema.statics.searchProfiles = function (query, options = {}) {
  return this.find(query, null, options);
};

ProfileSchema.statics.aggregateProfiles = function (pipeline) {
  return this.aggregate(pipeline);
};

const Profile = model("Profile", ProfileSchema);
export default Profile;
