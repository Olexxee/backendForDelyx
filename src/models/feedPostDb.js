import FeedPost from "./feedPostSchema.js";

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

export const createFeedPost = async (payload, options = {}) => {
  const { session = null } = options;
  return FeedPost.create([{ ...payload }], { session }).then(([doc]) => doc);
};

export const findFeedPostById = async (postId, options = {}) => {
  const {
    select = null,
    populate = null,
    session = null,
    lean = false,
  } = options;

  let query = FeedPost.findById(postId);

  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);
  if (session) query = query.session(session);
  if (lean) query = query.lean();

  return query;
};

export const findFeedPosts = async (query = {}, options = {}) => {
  const { page, limit, sort, select, populate, session, lean, skip } =
    normalizeListOptions(options);

  let itemsQuery = FeedPost.find(query).sort(sort).skip(skip).limit(limit);

  if (select) itemsQuery = itemsQuery.select(select);
  if (populate) itemsQuery = itemsQuery.populate(populate);
  if (session) itemsQuery = itemsQuery.session(session);
  if (lean) itemsQuery = itemsQuery.lean();

  let totalQuery = FeedPost.countDocuments(query);
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

export const findPostsByContext = async (
  { contextType, contextId, ...filters },
  options = {},
) => {
  const query = {
    ...filters,
    contextType,
    contextId: contextType === "general" ? null : contextId,
  };

  return findFeedPosts(query, options);
};

export const findPostsByAuthor = async (
  authorId,
  filters = {},
  options = {},
) => {
  return findFeedPosts(
    {
      author: authorId,
      ...filters,
    },
    options,
  );
};

export const updateFeedPostFields = async (postId, updates, options = {}) => {
  const { session = null, lean = false } = options;

  const allowedUpdates = {};
  const allowedKeys = [
    "content",
    "media",
    "visibility",
    "isPinned",
    "isFeatured",
  ];

  for (const key of allowedKeys) {
    if (key in updates) {
      allowedUpdates[key] = updates[key];
    }
  }

  let query = FeedPost.findByIdAndUpdate(postId, allowedUpdates, {
    new: true,
    runValidators: true,
    session,
  });

  if (lean) query = query.lean();

  return query;
};

export const setFeedPostStatus = async (postId, status, options = {}) => {
  const { session = null, lean = false } = options;

  let query = FeedPost.findByIdAndUpdate(
    postId,
    { status },
    {
      new: true,
      runValidators: true,
      session,
    },
  );

  if (lean) query = query.lean();

  return query;
};

export const setFeedPostPinnedState = async (
  postId,
  isPinned,
  options = {},
) => {
  return updateFeedPostFields(postId, { isPinned }, options);
};

export const setFeedPostFeaturedState = async (
  postId,
  isFeatured,
  options = {},
) => {
  return updateFeedPostFields(postId, { isFeatured }, options);
};

export const incrementPostCommentsCount = async (
  postId,
  value = 1,
  options = {},
) => {
  const { session = null, lean = false } = options;

  let query = FeedPost.findByIdAndUpdate(
    postId,
    { $inc: { commentsCount: value } },
    { new: true, session },
  );

  if (lean) query = query.lean();

  return query;
};

export const incrementPostReactionsCount = async (
  postId,
  value = 1,
  options = {},
) => {
  const { session = null, lean = false } = options;

  let query = FeedPost.findByIdAndUpdate(
    postId,
    { $inc: { reactionsCount: value } },
    { new: true, session },
  );

  if (lean) query = query.lean();

  return query;
};
