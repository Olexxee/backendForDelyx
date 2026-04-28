import {
  BadRequestError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import {
  createFeedPost,
  findFeedPostById,
  findFeedPosts,
  findPostsByAuthor,
  findPostsByContext,
  setFeedPostStatus,
  updateFeedPostFields,
} from "../../models/feedPostDb.js";
import { findReactionsForTargets } from "../../models/feedReactionDb.js";
import cacheManager from "../../lib/cacheManager.js";
import { mapPostToPlayerFeedItem } from "./mappers/feedItemMapper.js";
import {
  buildFeedQuery,
  findFeedPostsForUser,
} from "./feedQueryBuilder.js";

// ─── Cache Keys & Helpers ───────────────────────────────────────────────────

const CACHE_TTL = {
  HOME_FEED: 60, // 1 minute - high traffic, frequent changes
  CONTEXT_FEED: 30, // 30 seconds - group/tournament feeds
  AUTHOR_FEED: 60, // 1 minute
  SINGLE_POST: 300, // 5 minutes - posts change less frequently
};

const CACHE_PATTERNS = {
  HOME_FEED: (userId) => `feed:home:${userId}:*`,
  CONTEXT_FEED: (contextType, contextId) =>
    `feed:context:${contextType}:${contextId}:*`,
  AUTHOR_FEED: (authorId) => `feed:author:${authorId}:*`,
  SINGLE_POST: (postId) => `feed:post:${postId}`,
};

// ─── Cache Invalidation Helpers ────────────────────────────────────────────

/**
 * Invalidate all caches that might contain a specific post
 */
const invalidatePostCaches = async (post, oldPost = null) => {
  if (!post) return;

  const authorId =
    typeof post.author === "object" ? post.author._id : post.author;
  const oldAuthorId = oldPost
    ? typeof oldPost.author === "object"
      ? oldPost.author._id
      : oldPost.author
    : null;

  // 1. Invalidate author's home feed (always needed for create/update/delete)
  await invalidateHomeFeedCache(authorId);

  // If author changed (rare, but possible with admin actions), invalidate old author too
  if (oldAuthorId && oldAuthorId.toString() !== authorId?.toString()) {
    await invalidateHomeFeedCache(oldAuthorId);
  }

  // 2. Invalidate context-specific caches
  const contextsToInvalidate = new Set();

  // Current context
  if (post.contextType && post.contextId) {
    contextsToInvalidate.add(`${post.contextType}:${post.contextId}`);
  }

  // Old context (if context changed)
  if (oldPost && oldPost.contextType && oldPost.contextId) {
    if (
      oldPost.contextType !== post.contextType ||
      oldPost.contextId !== post.contextId
    ) {
      contextsToInvalidate.add(`${oldPost.contextType}:${oldPost.contextId}`);
    }
  }

  for (const context of contextsToInvalidate) {
    const [contextType, contextId] = context.split(":");
    await invalidateContextCache(contextType, contextId);
  }

  // 3. Invalidate author profile feed
  await invalidateAuthorFeedCache(authorId);

  // 4. If status changed from/to active, wider invalidation needed
  const statusChanged = oldPost && oldPost.status !== post.status;
  const visibilityChanged = oldPost && oldPost.visibility !== post.visibility;

  if (statusChanged || visibilityChanged) {
    // Post became active - needs to appear in more feeds
    // Post became inactive - needs to disappear from feeds
    await invalidateWideFeedsForAuthor(authorId);

    // Also invalidate all context feeds for this post's contexts
    for (const context of contextsToInvalidate) {
      const [contextType, contextId] = context.split(":");
      await invalidateContextCache(contextType, contextId, true); // full invalidation
    }
  }

  // 5. Invalidate single post cache
  if (post._id) {
    await cacheManager.delete(CACHE_PATTERNS.SINGLE_POST(post._id.toString()));
  }
};

/**
 * Invalidate home feed for a specific user
 */
const invalidateHomeFeedCache = async (userId) => {
  if (!userId) return;
  const pattern = CACHE_PATTERNS.HOME_FEED(userId.toString());
  await cacheManager.deleteByPattern(pattern);
};

/**
 * Invalidate context-specific feeds (group, tournament, etc.)
 */
const invalidateContextCache = async (
  contextType,
  contextId,
  fullInvalidation = false,
) => {
  if (!contextType || !contextId) return;

  if (fullInvalidation) {
    // Delete all caches for this context
    const pattern = CACHE_PATTERNS.CONTEXT_FEED(contextType, contextId);
    await cacheManager.deleteByPattern(pattern);
  } else {
    // More targeted invalidation - could delete first few pages only
    // For now, do full invalidation for simplicity
    const pattern = CACHE_PATTERNS.CONTEXT_FEED(contextType, contextId);
    await cacheManager.deleteByPattern(pattern);
  }
};

/**
 * Invalidate author feed caches
 */
const invalidateAuthorFeedCache = async (authorId) => {
  if (!authorId) return;
  const pattern = CACHE_PATTERNS.AUTHOR_FEED(authorId.toString());
  await cacheManager.deleteByPattern(pattern);
};

/**
 * Invalidate wider feed caches that might include this author's posts
 * This is more expensive - use sparingly
 */
const invalidateWideFeedsForAuthor = async (authorId) => {
  if (!authorId) return;

  // For "for-you" feeds - we need to invalidate paginated caches
  // Since we can't efficiently target only feeds containing this author,
  // we either:
  // 1. Delete all for-you feeds (expensive but simple)
  // 2. Use a timestamp-based invalidation system (more complex)
  // 3. Keep TTL short and accept eventual consistency

  // Option 1: Delete all for-you feeds (acceptable for now)
  await cacheManager.deleteByPattern("feed:home:*:tab:for-you:*");

  // Option 2: Could also invalidate "following" feeds for author's followers
  // This requires knowing who follows the author - implement if needed
};

// ─── Guards ───────────────────────────────────────────────────────────────────

const ensurePostContent = ({ content, media }) => {
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedMedia = Array.isArray(media) ? media.filter(Boolean) : [];

  if (!normalizedContent && normalizedMedia.length === 0) {
    throw new BadRequestError(
      "A post must contain content or at least one media item.",
    );
  }

  return { content: normalizedContent, media: normalizedMedia };
};

const ensureContextConsistency = ({ contextType, contextId, visibility }) => {
  if (contextType !== "general" && !contextId) {
    throw new BadRequestError(
      "contextId is required when contextType is not 'general'.",
    );
  }

  if (contextType === "general" && contextId) {
    throw new BadRequestError(
      "contextId must be null when contextType is 'general'.",
    );
  }

  if (visibility === "group_members" && contextType !== "group") {
    throw new BadRequestError(
      "visibility 'group_members' requires group context.",
    );
  }

  if (
    visibility === "tournament_participants" &&
    contextType !== "tournament"
  ) {
    throw new BadRequestError(
      "visibility 'tournament_participants' requires tournament context.",
    );
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createPost = async (payload, options = {}) => {
  const normalized = ensurePostContent({
    content: payload.content,
    media: payload.media,
  });

  ensureContextConsistency({
    contextType: payload.contextType,
    contextId: payload.contextId,
    visibility: payload.visibility,
  });

  const post = await createFeedPost(
    {
      author: payload.author,
      content: normalized.content,
      media: normalized.media,
      contextType: payload.contextType,
      contextId: payload.contextId,
      visibility: payload.visibility,
    },
    options,
  );

  // Invalidate caches
  await invalidatePostCaches(post);

  return post;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getPostById = async (postId, options = {}) => {
  if (!postId) throw new BadRequestError("postId is required.");

  // Try cache first
  const cacheKey = CACHE_PATTERNS.SINGLE_POST(postId);
  const cached = await cacheManager.get(cacheKey);

  if (cached && !options.skipCache) {
    return cached;
  }

  const post = await findFeedPostById(postId, options);

  if (!post) throw new NotFoundException("Post not found.");

  // Cache single post (short TTL since posts can be updated)
  await cacheManager.set(cacheKey, post, CACHE_TTL.SINGLE_POST);

  return post;
};

export const getHomeFeed = async (userId, query = {}) => {
  const { page = 1, limit = 20, tab = "for-you", skipCache = false } = query;

  const normalizedPage = Number(page) || 1;
  const normalizedLimit = Number(limit) || 20;

  const cacheKey = `feed:home:${userId}:tab:${tab}:page:${normalizedPage}:limit:${normalizedLimit}`;

  if (!skipCache) {
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }
  }



  const postsResult = await findFeedPostsForUser(
    userId,
    {},
    {
      page: normalizedPage,
      limit: normalizedLimit,
      sort: tab === "recent" ? { createdAt: -1 } : { score: -1, createdAt: -1 },
      populate: [
        { path: "author", select: "username profilePicture" },
        { path: "media" },
      ],
      lean: true,
    },
  );

  const postIds = postsResult.items.map((post) => post._id);

  const viewerReactions = await findReactionsForTargets({
    user: userId,
    targetType: "post",
    targetIds: postIds,
  });

  const reactedPostIds = new Set(
    viewerReactions.map((reaction) => reaction.targetId.toString()),
  );

  const response = {
    actions: [],
    banner: null,
    items: postsResult.items.map((post) =>
      mapPostToPlayerFeedItem(post, reactedPostIds),
    ),
    nextCursor: null,
    meta: {
      tab,
    },
  };

  await cacheManager.set(cacheKey, response, CACHE_TTL.HOME_FEED);

  return response;
};

/**
 * Raw paginated query — no visibility scoping.
 * Use only in admin/internal contexts.
 */
export const getPosts = async (query = {}, options = {}) => {
  const { page = 1, limit = 20, ...filters } = query;

  return findFeedPosts(filters, {
    ...options,
    page: Number(page),
    limit: Number(limit),
  });
};

/**
 * Visibility-scoped feed for a given user.
 * Respects group memberships and tournament participation.
 */
export const getPostsForUser = async (userId, query = {}, options = {}) => {
  const { page = 1, limit = 20, skipCache = false, ...filters } = query;

  // Check cache if not skipped
  if (!skipCache) {
    const cacheKey = `feed:user:${userId}:${JSON.stringify(filters)}:page:${page}:limit:${limit}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await findFeedPostsForUser(userId, filters, {
      ...options,
      page: Number(page),
      limit: Number(limit),
    });

    await cacheManager.set(cacheKey, result, CACHE_TTL.HOME_FEED);
    return result;
  }

  return findFeedPostsForUser(userId, filters, {
    ...options,
    page: Number(page),
    limit: Number(limit),
  });
};

export const getPostsByContext = async (
  { contextType, contextId, status = "active" },
  options = {},
) => {
  return findPostsByContext({ contextType, contextId, status }, options);
};

/**
 * Context posts filtered by user visibility.
 */
export const getPostsByContextForUser = async (
  userId,
  { contextType, contextId, status = "active", skipCache = false },
  options = {},
) => {
  const { page = 1, limit = 20 } = options;

  if (!skipCache) {
    const cacheKey = `feed:context:${contextType}:${contextId}:user:${userId}:page:${page}:limit:${limit}:status:${status}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await findFeedPostsForUser(
      userId,
      { contextType, contextId, status },
      options,
    );

    await cacheManager.set(cacheKey, result, CACHE_TTL.CONTEXT_FEED);
    return result;
  }

  return findFeedPostsForUser(
    userId,
    { contextType, contextId, status },
    options,
  );
};

export const getPostsByAuthor = async (
  { authorId, status = "active" },
  options = {},
) => {
  return findPostsByAuthor(authorId, { status }, options);
};

/**
 * Author posts filtered by user visibility.
 */
export const getPostsByAuthorForUser = async (
  userId,
  { authorId, status = "active", skipCache = false },
  options = {},
) => {
  const { page = 1, limit = 20 } = options;

  if (!skipCache) {
    const cacheKey = `feed:author:${authorId}:user:${userId}:page:${page}:limit:${limit}:status:${status}`;
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await findFeedPostsForUser(
      userId,
      { author: authorId, status },
      options,
    );

    await cacheManager.set(cacheKey, result, CACHE_TTL.AUTHOR_FEED);
    return result;
  }

  return findFeedPostsForUser(userId, { author: authorId, status }, options);
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updatePost = async (postId, updates, options = {}) => {
  const existingPost = await getPostById(postId, {
    ...options,
    skipCache: true,
  });

  if (existingPost.status === "deleted") {
    throw new BadRequestError("Deleted posts cannot be edited.");
  }

  const nextContent =
    "content" in updates ? updates.content : existingPost.content;
  const nextMedia = "media" in updates ? updates.media : existingPost.media;

  const normalized = ensurePostContent({
    content: nextContent,
    media: nextMedia,
  });

  const nextVisibility =
    "visibility" in updates ? updates.visibility : existingPost.visibility;

  ensureContextConsistency({
    contextType: existingPost.contextType,
    contextId: existingPost.contextId,
    visibility: nextVisibility,
  });

  const allowedUpdates = {
    content: normalized.content,
    media: normalized.media,
    visibility: nextVisibility,
  };

  if ("isPinned" in updates) allowedUpdates.isPinned = updates.isPinned;
  if ("isFeatured" in updates) allowedUpdates.isFeatured = updates.isFeatured;

  const updated = await updateFeedPostFields(postId, allowedUpdates, options);

  if (!updated) throw new NotFoundException("Post not found.");

  // Invalidate caches with both old and new state
  await invalidatePostCaches(updated, existingPost);

  return updated;
};

// ─── Status Transitions ───────────────────────────────────────────────────────

export const softDeletePost = async (postId, options = {}) => {
  const existingPost = await getPostById(postId, {
    ...options,
    skipCache: true,
  });

  if (existingPost.status === "deleted") return existingPost;

  const deleted = await setFeedPostStatus(postId, "deleted", options);

  if (!deleted) throw new NotFoundException("Post not found.");

  await invalidatePostCaches(deleted, existingPost);

  return deleted;
};

export const hidePost = async (postId, options = {}) => {
  const existingPost = await getPostById(postId, {
    ...options,
    skipCache: true,
  });

  const updated = await setFeedPostStatus(postId, "hidden", options);

  if (!updated) throw new NotFoundException("Post not found.");

  await invalidatePostCaches(updated, existingPost);

  return updated;
};

export const flagPost = async (postId, options = {}) => {
  const existingPost = await getPostById(postId, {
    ...options,
    skipCache: true,
  });

  const updated = await setFeedPostStatus(postId, "flagged", options);

  if (!updated) throw new NotFoundException("Post not found.");

  await invalidatePostCaches(updated, existingPost);

  return updated;
};

export const updatePostStatus = async (postId, status, options = {}) => {
  const existingPost = await getPostById(postId, {
    ...options,
    skipCache: true,
  });

  const updated = await setFeedPostStatus(postId, status, options);

  if (!updated) throw new NotFoundException("Post not found.");

  await invalidatePostCaches(updated, existingPost);

  return updated;
};

// Export for use in controllers when bulk operations are needed
export const invalidateUserFeeds = invalidateHomeFeedCache;
export const invalidateContextFeeds = invalidateContextCache;
export const invalidateAuthorFeeds = invalidateAuthorFeedCache;

export { setFeedPostStatus };
