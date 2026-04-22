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

const ensurePostContent = ({ content, media }) => {
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedMedia = Array.isArray(media) ? media.filter(Boolean) : [];

  if (!normalizedContent && normalizedMedia.length === 0) {
    throw new BadRequestError(
      "A post must contain content or at least one media item.",
    );
  }

  return {
    content: normalizedContent,
    media: normalizedMedia,
  };
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

  return createFeedPost(
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
};

export const getPostById = async (postId, options = {}) => {
  if (!postId) {
    throw new BadRequestError("postId is required.");
  }

  const post = await findFeedPostById(postId, options);

  if (!post) {
    throw new NotFoundException("Post not found.");
  }

  return post;
};

export const getPosts = async (query = {}, options = {}) => {
  const { page = 1, limit = 20, ...filters } = query;

  return findFeedPosts(filters, {
    ...options,
    page,
    limit,
  });
};

export const getPostsByContext = async (
  { contextType, contextId, status = "active" },
  options = {},
) => {
  return findPostsByContext(
    {
      contextType,
      contextId,
      status,
    },
    options,
  );
};

export const getPostsByAuthor = async (
  { authorId, status = "active" },
  options = {},
) => {
  return findPostsByAuthor(authorId, { status }, options);
};

export const updatePost = async (postId, updates, options = {}) => {
  const existingPost = await getPostById(postId, options);

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

  if ("isPinned" in updates) {
    allowedUpdates.isPinned = updates.isPinned;
  }

  if ("isFeatured" in updates) {
    allowedUpdates.isFeatured = updates.isFeatured;
  }

  const updated = await updateFeedPostById(postId, allowedUpdates, options);

  if (!updated) {
    throw new NotFoundException("Post not found.");
  }

  return updated;
};

export const softDeletePost = async (postId, options = {}) => {
  const existingPost = await getPostById(postId, options);

  if (existingPost.status === "deleted") {
    return existingPost;
  }

  const deleted = await setFeedPostStatus(postId, "deleted", options);

  if (!deleted) {
    throw new NotFoundException("Post not found.");
  }

  return deleted;
};

export const hidePost = async (postId, options = {}) => {
  const updated = await setFeedPostStatus(postId, "hidden", options);

  if (!updated) {
    throw new NotFoundException("Post not found.");
  }

  return updated;
};

export const flagPost = async (postId, options = {}) => {
  const updated = await setFeedPostStatus(postId, "flagged", options);

  if (!updated) {
    throw new NotFoundException("Post not found.");
  }

  return updated;
};

export { setFeedPostStatus };
