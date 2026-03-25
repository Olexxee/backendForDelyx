import logger from "../../lib/logger.js";
import * as postDB from "../../models/postSchemaService.js";
import * as commentDB from "../../models/timelineCommentSchemaService.js";
import * as reactionDB from "../../models/timelineReactionShemaService.js";
import {
  NotFoundException,
  ForbiddenError,
  BadRequestError,
} from "../../lib/classes/errorClasses.js";

// --- Posts ---
export const createPost = async (user, payload) => {
  if (!payload.content && (!payload.media || payload.media.length === 0)) {
    throw new BadRequestError("Post must have text or media.");
  }

  const doc = await postDB.createPost({
    author: user.id || user._id,
    content: payload.content || "",
    media: payload.media || [],
    visibility: payload.visibility || "public",
    tags: payload.tags || [],
    authorVerified: !!user.isVerified,
  });

  return doc;
};

export const deletePost = async (user, postId, isAdmin = false) => {
  const post = await postDB.findPostById(postId);
  if (!post) throw new NotFoundException("Post not found");

  const userId = user.id || user._id;
  const isOwner = post.author.toString() === userId.toString();
  if (!isOwner && !isAdmin) throw new ForbiddenError("Not allowed");

  await postDB.deletePostById(postId);
  // (Optional) TODO: cascade delete comments/reactions in a background job
  return { message: "Post deleted" };
};

export const getFeed = async (
  user,
  { page = 1, limit = 10, scope = "default" }
) => {
  const query = { visibility: "public" }; // Only public posts for anonymous users

  if (user) {
    const userId = user.id || user._id;
    // Include user's own posts
    query.$or = [{ visibility: "public" }, { author: userId }];
  }

  // TODO: expand with connections logic if `user` is present
  return postDB.findFeed(query, { page, limit });
};

// --- Comments ---
export const addComment = async (
  user,
  postId,
  { content, media = [], parentComment = null }
) => {
  const post = await postDB.findPostById(postId);
  if (!post) throw new NotFoundException("Post not found");

  const userId = user.id || user._id;
  const comment = await commentDB.createComment({
    post: postId,
    author: userId,
    content,
    media,
    parentComment,
    authorVerified: !!user.isVerified,
  });

  await postDB.updatePostById(postId, { $inc: { commentsCount: 1 } });

  return comment;
};

export const deleteComment = async (user, commentId, isAdmin = false) => {
  const comment = await commentDB.findCommentById(commentId);
  if (!comment) throw new NotFoundException("Comment not found");

  const userId = user.id || user._id;
  const isOwner = comment.author.toString() === userId.toString();
  if (!isOwner && !isAdmin) throw new ForbiddenError("Not allowed");

  await commentDB.deleteCommentById(commentId);
  await postDB.updatePostById(comment.post, { $inc: { commentsCount: -1 } });

  return { message: "Comment deleted" };
};

export const listComments = async (postId, { page = 1, limit = 20 } = {}) => {
  return commentDB.getCommentsForPost(postId, { page, limit });
};

// --- Reactions (Likes) ---
export const likePost = async (user, postId) => {
  const post = await postDB.findPostById(postId);
  if (!post) throw new NotFoundException("Post not found");

  const userId = user.id || user._id;
  const existing = await reactionDB.hasReaction(userId, "post", postId);
  if (existing) return { message: "Already liked" };

  await reactionDB.upsertReaction({
    user: userId,
    targetType: "post",
    targetId: postId,
    type: "like",
  });
  await postDB.updatePostById(postId, { $inc: { likesCount: 1 } });

  return { message: "Liked" };
};

export const unlikePost = async (user, postId) => {
  const userId = user.id || user._id;
  const removed = await reactionDB.removeReaction(userId, "post", postId);
  if (!removed) return { message: "Not liked" };

  await postDB.updatePostById(postId, { $inc: { likesCount: -1 } });
  return { message: "Unliked" };
};
