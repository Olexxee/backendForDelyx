import Membership from "./membershipSchema.js";

// Create membership
export const createMembership = async (payload) => {
  return await Membership.create(payload);
};

// Find a user's membership in a group
export const findMembership = async ({ userId, groupId }) => {
  return await Membership.findOne({ userId, groupId });
};

// Get all memberships for a group
export const findMembersByGroupId = async (groupId) => {
  return Membership.find({ groupId, status: "active" }).sort({ joinedAt: 1 });
};

// Get all memberships for a user
export const findGroupsByUser = async (
  { userId, status = "active" },
  { skip = 0, limit = 20 } = {},
) => {
  return Membership.find({ userId, status })
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(limit);
};

export const getMemberPreview = async (groupId) => {
  const members = await Membership.find({ groupId })
    .populate("userId", "username profilePicture")
    .select("roleInGroup status joinedAt")
    .limit(5);
  return members;
};

export const countMemberships = async (filters = {}) => {
  return await Membership.countDocuments(filters);
};

// Count memberships for a user (for pagination or stats)
export const countGroupsByUser = async ({ userId, status = "active" }) => {
  return Membership.countDocuments({ userId, status });
};

// Update a user's membership (role, status, etc.)
export const updateMembership = async ({ userId, groupId }, updatePayload) => {
  return await Membership.findOneAndUpdate({ userId, groupId }, updatePayload, {
    new: true,
  });
};

// Remove user from group
export const removeMembership = async ({ userId, groupId }) => {
  return await Membership.findOneAndDelete({ userId, groupId });
};
