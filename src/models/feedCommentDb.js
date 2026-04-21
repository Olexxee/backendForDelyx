import FeedComment from "./feedCommentSchema.js";

const normalizeListOptions = (options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select = null,
    populate = null,
    session = null,
    lean = true,
  } = options;

  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.max(Number(limit) || 20, 1);
  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    sort,
    select,
    populate,
    session,
    lean,
    skip,
  };
};

export const createFeedComment = async (payload, options = {}) => {
  const { session = null } = options;
  return FeedComment.create([{ ...payload }], { session }).then(([doc]) => doc);
};

export const findFeedCommentById = async (commentId, options = {}) => {
  const {
    select = null,
    populate = null,
    session = null,
    lean = false,
  } = options;

  let query = FeedComment.findById(commentId);

  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);
  if (session) query = query.session(session);
  if (lean) query = query.lean();

  return query;
};

export const findCommentsForPost = async (
  postId,
  filters = {},
  options = {},
) => {
  const { page, limit, sort, select, populate, session, lean, skip } =
    normalizeListOptions(options);

  const query = {
    post: postId,
    parentComment: null,
    ...filters,
  };

  let itemsQuery = FeedComment.find(query).sort(sort).skip(skip).limit(limit);

  if (select) itemsQuery = itemsQuery.select(select);
  if (populate) itemsQuery = itemsQuery.populate(populate);
  if (session) itemsQuery = itemsQuery.session(session);
  if (lean) itemsQuery = itemsQuery.lean();

  let totalQuery = FeedComment.countDocuments(query);
  if (session) totalQuery = totalQuery.session(session);

  const [items, total] = await Promise.all([itemsQuery, totalQuery]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

export const findRepliesForComment = async (
  parentCommentId,
  filters = {},
  options = {},
) => {
  const { page, limit, sort, select, populate, session, lean, skip } =
    normalizeListOptions(options);

  const query = {
    parentComment: parentCommentId,
    ...filters,
  };

  let itemsQuery = FeedComment.find(query).sort(sort).skip(skip).limit(limit);

  if (select) itemsQuery = itemsQuery.select(select);
  if (populate) itemsQuery = itemsQuery.populate(populate);
  if (session) itemsQuery = itemsQuery.session(session);
  if (lean) itemsQuery = itemsQuery.lean();

  let totalQuery = FeedComment.countDocuments(query);
  if (session) totalQuery = totalQuery.session(session);

  const [items, total] = await Promise.all([itemsQuery, totalQuery]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

export const updateFeedCommentById = async (
  commentId,
  updates,
  options = {},
) => {
  const { session = null, lean = false } = options;

  let query = FeedComment.findByIdAndUpdate(commentId, updates, {
    new: true,
    runValidators: true,
    session,
  });

  if (lean) query = query.lean();

  return query;
};

export const setFeedCommentStatus = async (commentId, status, options = {}) => {
  return updateFeedCommentById(commentId, { status }, options);
};

export const incrementCommentReactionsCount = async (
  commentId,
  value = 1,
  options = {},
) => {
  const { session = null, lean = false } = options;

  let query = FeedComment.findByIdAndUpdate(
    commentId,
    { $inc: { reactionsCount: value } },
    { new: true, session },
  );

  if (lean) query = query.lean();

  return query;
};
