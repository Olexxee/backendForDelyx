import User from "./userSchema.js";
import UserStats from "../user/userStatSchema.js";
import { serializeUser } from "../lib/serializeUser.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

// ============================================================
// CREATE
// ============================================================

export const createUser = async (payload, options = {}) => {
  const { session } = options;
  const [user] = await User.create([payload], { session });
  return user;
};

// ============================================================
// FIND
// ============================================================

export const findUser = async (filter, options = {}) => {
  const { session, select } = options;

  let query = User.findOne(filter).session(session || null);

  if (select) {
    query = query.select(select);
  }

  return query;
};

export const findUserByEmail = async ({ email }, options = {}) => {
  const { session } = options;
  return User.findOne({ email }).session(session || null);
};

export const findUserWithVerificationFields = async (
  { email },
  options = {},
) => {
  const { session } = options;

  return User.findOne({ email })
    .select("+verificationCode +verificationCodeExpiresAt")
    .session(session || null);
};

export const findUserByUsername = async ({ username }, options = {}) => {
  const { session } = options;
  return User.findOne({ username }).session(session || null);
};

export const findUserById = async (id, options = {}) => {
  const { session, select } = options;

  let query = User.findById(id).session(session || null);

  if (select) {
    query = query.select(select);
  }

  return query;
};

// ============================================================
// PROFILE
// ============================================================

export const getUserProfile = async (userId, options = {}) => {
  const { session } = options;

  const user = await User.findById(userId)
    .select(
      "-password -verificationCode -verificationCodeValidation -verificationCodeExpiresAt",
    )
    .lean()
    .session(session || null);

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const stats = await UserStats.find({ user: userId })
    .populate("tournamentsPlayedIn.tournamentId", "name status settings")
    .populate("tournamentsPlayedIn.fixtures.opponent", "username profilePicture")
    .lean()
    .session(session || null);

  return serializeUser(user, stats.flatMap((entry) => entry.tournamentsPlayedIn));
};

// ============================================================
// UPDATE
// ============================================================

export const findAndUpdateUserById = async (
  id,
  updateData,
  options = {},
) => {
  const {
    session,
    new: returnNew = true,
    runValidators = true,
  } = options;

  return User.findByIdAndUpdate(id, updateData, {
    new: returnNew,
    runValidators,
    session,
  });
};

export const updateUserByEmail = async (
  email,
  updateData,
  options = {},
) => {
  const {
    session,
    new: returnNew = true,
    runValidators = true,
  } = options;

  return User.findOneAndUpdate({ email }, updateData, {
    new: returnNew,
    runValidators,
    session,
  });
};

export const incrementTimesKicked = async (
  userId,
  options = {},
) => {
  const {
    session,
    new: returnNew = true,
  } = options;

  return User.findByIdAndUpdate(
    userId,
    { $inc: { timesKicked: 1 } },
    {
      new: returnNew,
      session,
    },
  );
};

// ============================================================
// GROUP RELATION HELPERS
// ============================================================

export const addGroupToUser = async (
  { userId, groupId },
  options = {},
) => {
  const {
    session,
    new: returnNew = true,
  } = options;

  return User.findByIdAndUpdate(
    userId,
    {
      $addToSet: { groups: groupId },
      $inc: { groupsJoinedCount: 1 },
    },
    {
      new: returnNew,
      session,
    },
  );
};

export const removeGroupFromUser = async (
  { userId, groupId },
  options = {},
) => {
  const {
    session,
    new: returnNew = true,
  } = options;

  return User.findByIdAndUpdate(
    userId,
    {
      $pull: { groups: groupId },
      $inc: { groupsJoinedCount: -1 },
    },
    {
      new: returnNew,
      session,
    },
  );
};

// ============================================================
// DELETE
// ============================================================

export const deleteUser = async ({ id }, options = {}) => {
  const { session } = options;
  return User.findByIdAndDelete(id).session(session || null);
};