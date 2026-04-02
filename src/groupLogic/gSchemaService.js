import mongoose from "mongoose";
import Group from "./groupSchema.js";

// ============================================================
// CREATE
// ============================================================

export const createGroup = async (payload, options = {}) => {
  const { session } = options;
  const [group] = await Group.create([payload], { session });
  return group;
};

// ============================================================
// FIND
// ============================================================

export const findGroupById = async (groupId, options = {}) => {
  const { session, select, populate = [] } = options;

  let query = Group.findById(groupId).session(session || null);

  if (select) query = query.select(select);
  for (const item of populate) query = query.populate(item);

  return query.exec();
};

export const findGroupsByIds = async (ids, options = {}) => {
  const { session, populateChatRoom = false, lean = true } = options;

  let query = Group.find({ _id: { $in: ids } }).session(session || null);

  if (populateChatRoom) query = query.populate("chatRoom").populate("avatar");
  if (lean) query = query.lean();

  return query.exec();
};

export const searchGroupsByName = async ({ name }, options = {}) => {
  const { session, limit = 20 } = options;

  if (!name || !name.trim()) return [];

  const regex = new RegExp(name.trim(), "i");
  return Group.find({ name: regex })
    .limit(limit)
    .session(session || null)
    .exec();
};

export const findGroupByName = async (name, options = {}) => {
  const { session } = options;
  return Group.findOne({ name })
    .session(session || null)
    .exec();
};

export const findGroupByJoinCode = async (joinCode, options = {}) => {
  const { session } = options;
  return Group.findOne({ joinCode })
    .session(session || null)
    .exec();
};

export const findGroupsCreatedByUser = async (userId, options = {}) => {
  const { session } = options;
  return Group.find({ createdBy: userId })
    .session(session || null)
    .exec();
};

export const findMyGroups = async (userId, options = {}) => {
  const { session } = options;
  return Group.find({
    _id: {
      $in: await mongoose.model("Membership").distinct("groupId", {
        userId,
        status: "active",
      }),
    },
  })
    .select("name bio avatar privacy totalMembers chatRoom lastActivityAt createdBy")
    .populate("avatar")
    .populate("chatRoom", "_id")
    .session(session || null)
    .lean()
    .exec();
};

export const findMyGroupsWithPreview = async (userId, options = {}) => {
  const { session } = options;

  const groupIds = await mongoose.model("Membership").distinct("groupId", {
    userId: new mongoose.Types.ObjectId(userId),
    status: "active",
  });

  if (!groupIds.length) return [];

  return Group.aggregate([
    { $match: { _id: { $in: groupIds } } },
    {
      $lookup: {
        from: "chatrooms",
        localField: "chatRoom",
        foreignField: "_id",
        as: "chatRoomDoc",
      },
    },
    { $unwind: { path: "$chatRoomDoc", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "media",
        localField: "avatar",
        foreignField: "_id",
        as: "avatarDoc",
      },
    },
    { $unwind: { path: "$avatarDoc", preserveNullAndEmptyArrays: true } },
    { $sort: { lastActivityAt: -1 } },
    {
      $project: {
        _id: 1,
        name: 1,
        bio: 1,
        privacy: 1,
        totalMembers: 1,
        createdBy: 1,
        lastActivityAt: 1,
        avatar: "$avatarDoc.url",
        chatRoomId: "$chatRoomDoc._id",
        lastMessagePreview: "$chatRoomDoc.lastMessagePreview",
        lastMessageAt: "$chatRoomDoc.lastMessageAt",
      },
    },
  ]).session(session || null);
};

// ============================================================
// UPDATE
// ============================================================

export const updateGroup = async (groupId, updatePayload, options = {}) => {
  const { session, new: returnNew = true, runValidators = true } = options;

  return Group.findByIdAndUpdate(groupId, updatePayload, {
    new: returnNew,
    runValidators,
    session,
  }).exec();
};

// ============================================================
// DELETE
// ============================================================

export const deleteGroup = async (groupId, options = {}) => {
  const { session } = options;
  return Group.findByIdAndDelete(groupId)
    .session(session || null)
    .exec();
};

// ============================================================
// SYNC HELPERS (Added for transaction consistency)
// ============================================================

export const incrementMemberCount = async (groupId, delta, options = {}) => {
  const { session } = options;
  return Group.findByIdAndUpdate(
    groupId,
    { $inc: { totalMembers: delta } },
    { new: true, session },
  ).exec();
};

export const createInviteCode = async (groupId, options = {}) => {
  const { session } = options;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  await Group.findByIdAndUpdate(
    groupId,
    { joinCode: code },
    { session },
  ).exec();

  return code;
};
