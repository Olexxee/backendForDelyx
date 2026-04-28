import {
  BadRequestError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import { validator } from "../../lib/classes/validatorClass.js";
import {
  createFeedCommentSchema,
  listFeedCommentsSchema,
  updateFeedCommentSchema,
} from "./validation/feedCommentValidation.js";
import {
  createFeedComment,
  findCommentsForPost,
  findFeedCommentById,
  findRepliesForComment,
  setFeedCommentStatus,
  updateFeedCommentById,
} from "../../models/feedCommentDb.js";
import { findFeedPostById } from "../../models/feedPostDb.js";
import { publishDomainEvent } from "../../queues/publishDomainEvent.js";
import { EVENT_TYPES } from "../../event/eventTypes.js";

export const createComment = async (payload, options = {}) => {
  const validated = validator.validate(createFeedCommentSchema, payload);

  const post = await findFeedPostById(validated.post, options);

  if (!post || post.status === "deleted") {
    throw new NotFoundException("Target post not found.");
  }

  if (validated.parentComment) {
    const parent = await findFeedCommentById(validated.parentComment, options);

    if (!parent || parent.status === "deleted") {
      throw new NotFoundException("Parent comment not found.");
    }

    if (String(parent.post) !== String(validated.post)) {
      throw new BadRequestError(
        "Parent comment does not belong to the provided post.",
      );
    }
  }

  const comment = await createFeedComment(validated, options);

  // Moved off the critical path — the HTTP response returns immediately.
  // The domain event worker handles incrementing commentsCount and
  // dispatching any notifications. Accepts ~1s eventual consistency
  // on the count displayed to other users.
  await publishDomainEvent(EVENT_TYPES.FEED_POST_COMMENTED, {
    postId: String(validated.post),
    commentId: String(comment._id),
    authorId: String(validated.author),
    postAuthorId: String(post.author?._id ?? post.author),
    isReply: Boolean(validated.parentComment),
    parentCommentId: validated.parentComment
      ? String(validated.parentComment)
      : null,
  });

  return comment;
};

export const getCommentById = async (commentId, options = {}) => {
  if (!commentId) {
    throw new BadRequestError("commentId is required.");
  }

  const comment = await findFeedCommentById(commentId, options);

  if (!comment) {
    throw new NotFoundException("Comment not found.");
  }

  return comment;
};

export const getCommentsForPost = async (
  { postId, status = "active", page = 1, limit = 20 },
  options = {},
) => {
  if (!postId) {
    throw new BadRequestError("postId is required.");
  }

  const validated = validator.validate(listFeedCommentsSchema, {
    page,
    limit,
    status,
  });

  return findCommentsForPost(
    postId,
    { status: validated.status },
    {
      ...options,
      page: validated.page,
      limit: validated.limit,
    },
  );
};

export const getRepliesForComment = async (
  { parentCommentId, status = "active", page = 1, limit = 20 },
  options = {},
) => {
  if (!parentCommentId) {
    throw new BadRequestError("parentCommentId is required.");
  }

  const validated = validator.validate(listFeedCommentsSchema, {
    page,
    limit,
    status,
  });

  return findRepliesForComment(
    parentCommentId,
    { status: validated.status },
    {
      ...options,
      page: validated.page,
      limit: validated.limit,
    },
  );
};

export const updateComment = async (commentId, updates, options = {}) => {
  if (!commentId) {
    throw new BadRequestError("commentId is required.");
  }

  const validated = validator.validate(updateFeedCommentSchema, updates);
  const existingComment = await getCommentById(commentId, options);

  if (existingComment.status === "deleted") {
    throw new BadRequestError("Deleted comments cannot be edited.");
  }

  const updated = await updateFeedCommentById(
    commentId,
    { content: validated.content },
    options,
  );

  if (!updated) {
    throw new NotFoundException("Comment not found.");
  }

  return updated;
};

export const softDeleteComment = async (commentId, options = {}) => {
  const existingComment = await getCommentById(commentId, options);

  if (existingComment.status === "deleted") {
    return existingComment;
  }

  const deleted = await setFeedCommentStatus(commentId, "deleted", options);

  if (!deleted) {
    throw new NotFoundException("Comment not found.");
  }

  // Moved off the critical path — worker handles the decrement.
  await publishDomainEvent(EVENT_TYPES.FEED_POST_COMMENT_DELETED, {
    postId: String(existingComment.post),
    commentId: String(existingComment._id),
  });

  return deleted;
};

export const hideComment = async (commentId, options = {}) => {
  const updated = await setFeedCommentStatus(commentId, "hidden", options);

  if (!updated) {
    throw new NotFoundException("Comment not found.");
  }

  return updated;
};

export const flagComment = async (commentId, options = {}) => {
  const updated = await setFeedCommentStatus(commentId, "flagged", options);

  if (!updated) {
    throw new NotFoundException("Comment not found.");
  }

  return updated;
};
