import FeedReaction from "./feedReactionSchema.js";

export const findReaction = async (query, options = {}) => {
  const { session = null, lean = false } = options;

  let dbQuery = FeedReaction.findOne(query);

  if (session) dbQuery = dbQuery.session(session);
  if (lean) dbQuery = dbQuery.lean();

  return dbQuery;
};

export const findReactionsForTargets = async ({ user, targetType, targetIds }, options = {}) => {
  const { session = null } = options;
  let query = FeedReaction.find({
    user,
    targetType,
    targetId: { $in: targetIds },
  }).lean();
  if (session) query = query.session(session);
  return query;
};

export const upsertReaction = async (payload, options = {}) => {
  const { session = null, lean = false } = options;

  let query = FeedReaction.findOneAndUpdate(
    {
      user: payload.user,
      targetType: payload.targetType,
      targetId: payload.targetId,
    },
    {
      $set: {
        reactionType: payload.reactionType ?? "like",
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  if (lean) query = query.lean();

  return query;
};

export const deleteReaction = async (query, options = {}) => {
  const { session = null } = options;
  return FeedReaction.findOneAndDelete(query).session(session);
};

export const countReactionsForTarget = async (
  { targetType, targetId, reactionType },
  options = {},
) => {
  const { session = null } = options;

  const query = {
    targetType,
    targetId,
  };

  if (reactionType) {
    query.reactionType = reactionType;
  }

  let countQuery = FeedReaction.countDocuments(query);

  if (session) countQuery = countQuery.session(session);

  return countQuery;
};
