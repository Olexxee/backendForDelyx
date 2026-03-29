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

  if (select) {
    query = query.select(select);
  }

  for (const item of populate) {
    query = query.populate(item);
  }

  return query;
};

export const findGroupsByIds = async (ids, options = {}) => {
  const { session, populateChatRoom = false, lean = true } = options;

  let query = Group.find({ _id: { $in: ids } }).session(session || null);

  if (populateChatRoom) {
    query = query.populate("chatRoom").populate("avatar");
  }

  if (lean) {
    query = query.lean();
  }

  return query;
};

export const searchGroupsByName = async ({ name }, options = {}) => {
  const { session, limit = 20 } = options;

  if (!name || !name.trim()) {
    return Group.find({}).limit(limit).session(session || null);
  }

  const regex = new RegExp(name.trim(), "i");
  return Group.find({ name: regex }).limit(limit).session(session || null);
};

export const findGroupByName = async (name, options = {}) => {
  const { session } = options;
  return Group.findOne({ name }).session(session || null);
};

export const findGroupByJoinCode = async (joinCode, options = {}) => {
  const { session } = options;
  return Group.findOne({ joinCode }).session(session || null);
};

export const findGroupsCreatedByUser = async (userId, options = {}) => {
  const { session } = options;
  return Group.find({ createdBy: userId }).session(session || null);
};

export const findUserGroupsWithLastMessage = async ({
  groupIds,
  skip = 0,
  limit = 20,
}) => {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return [];
  }

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
    {
      $unwind: {
        path: "$chatRoomDoc",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $sort: {
        "chatRoomDoc.lastMessageAt": -1,
      },
    },

    { $skip: skip },
    { $limit: limit },

    {
      $lookup: {
        from: "media",
        localField: "avatar",
        foreignField: "_id",
        as: "avatarDoc",
      },
    },
    {
      $unwind: {
        path: "$avatarDoc",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $project: {
        _id: 1,
        name: 1,
        avatar: "$avatarDoc.url",
        chatRoomId: "$chatRoomDoc._id",
        lastMessage: "$chatRoomDoc.lastMessagePreview",
        lastMessageAt: "$chatRoomDoc.lastMessageAt",
      },
    },
  ]);
};

// ============================================================
// UPDATE
// ============================================================

export const updateGroup = async (
  groupId,
  updatePayload,
  options = {},
) => {
  const { session, new: returnNew = true, runValidators = true } = options;

  return Group.findByIdAndUpdate(groupId, updatePayload, {
    new: returnNew,
    runValidators,
    session,
  });
};

// ============================================================
// DELETE
// ============================================================

export const deleteGroup = async (groupId, options = {}) => {
  const { session } = options;
  return Group.findByIdAndDelete(groupId).session(session || null);
};