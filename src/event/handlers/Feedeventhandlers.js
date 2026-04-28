import {
  incrementPostCommentsCount,
  incrementPostReactionsCount,
} from "../../models/feedPostDb.js";
import { incrementCommentReactionsCount } from "../../models/feedCommentDb.js";
import { enqueueNotificationJob } from "../../queues/notificationQueue.js";

// ─── Comment Handlers ─────────────────────────────────────────────────────────

/**
 * feed.post.commented
 *
 * Payload:
 *   postId, commentId, authorId, postAuthorId, isReply, parentCommentId
 */
export const handleFeedPostCommented = async (payload) => {
  const { postId, commentId, authorId, postAuthorId, isReply } = payload;

  await incrementPostCommentsCount(postId, 1);

  // Don't notify authors when they comment on their own post
  if (String(authorId) === String(postAuthorId)) return;

  await enqueueNotificationJob("feed.notify.comment", {
    recipientId: postAuthorId,
    actorId: authorId,
    targetType: "post",
    targetId: postId,
    commentId,
    isReply,
  });
};

/**
 * feed.post.comment_deleted
 *
 * Payload:
 *   postId, commentId
 */
export const handleFeedPostCommentDeleted = async (payload) => {
  const { postId } = payload;
  await incrementPostCommentsCount(postId, -1);
};

// ─── Post Reaction Handlers ───────────────────────────────────────────────────

/**
 * feed.post.reacted
 *
 * Payload:
 *   targetType, targetId, userId, reactionType, targetAuthorId
 */
export const handleFeedPostReacted = async (payload) => {
  const { targetId, userId, targetAuthorId } = payload;

  await incrementPostReactionsCount(targetId, 1);

  if (String(userId) === String(targetAuthorId)) return;

  await enqueueNotificationJob("feed.notify.reaction", {
    recipientId: targetAuthorId,
    actorId: userId,
    targetType: "post",
    targetId,
  });
};

/**
 * feed.post.unreacted
 *
 * Payload:
 *   targetType, targetId, userId
 */
export const handleFeedPostUnreacted = async (payload) => {
  const { targetId } = payload;
  await incrementPostReactionsCount(targetId, -1);
};

// ─── Comment Reaction Handlers ────────────────────────────────────────────────

/**
 * feed.comment.reacted
 *
 * Payload:
 *   targetType, targetId, userId, reactionType, targetAuthorId
 */
export const handleFeedCommentReacted = async (payload) => {
  const { targetId, userId, targetAuthorId } = payload;

  await incrementCommentReactionsCount(targetId, 1);

  if (String(userId) === String(targetAuthorId)) return;

  await enqueueNotificationJob("feed.notify.reaction", {
    recipientId: targetAuthorId,
    actorId: userId,
    targetType: "comment",
    targetId,
  });
};

/**
 * feed.comment.unreacted
 *
 * Payload:
 *   targetType, targetId, userId
 */
export const handleFeedCommentUnreacted = async (payload) => {
  const { targetId } = payload;
  await incrementCommentReactionsCount(targetId, -1);
};
