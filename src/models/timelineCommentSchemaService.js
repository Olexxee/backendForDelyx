import logger from "../lib/logger.js";
import TimelineComment from "./timelineCommentSchema.js";

// Create a new comment
export const createComment = async (data) => {
  return await TimelineComment.create(data);
};

// Find a comment by ID
export const findCommentById = async (id) => {
  return await TimelineComment.findById(id);
};

// Delete a comment by ID
export const deleteCommentById = async (id) => {
  return await TimelineComment.findByIdAndDelete(id);
};

// Get top-level comments for a post with pagination
export const getCommentsForPost = async (
  postId,
  { page = 1, limit = 20 } = {}
) => {
  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    TimelineComment.find({ post: postId, parentComment: null })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TimelineComment.countDocuments({ post: postId, parentComment: null }),
  ]);

  return {
    items,
    total,
    page: Number(page),
    totalPages: Math.max(Math.ceil(total / Number(limit)), 1),
  };
};
