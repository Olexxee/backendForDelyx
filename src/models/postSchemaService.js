import logger from "../lib/logger.js";
import TimelinePost from "./postSchema.js";

// Create a new post
export const createPost = async (data) => {
  return await TimelinePost.create(data);
};

// Find a post by ID
export const findPostById = async (id) => {
  return await TimelinePost.findById(id);
};

// Update a post by ID
export const updatePostById = async (id, updates) => {
  return await TimelinePost.findByIdAndUpdate(id, updates, { new: true });
};

// Delete a post by ID
export const deletePostById = async (id) => {
  return await TimelinePost.findByIdAndDelete(id);
};

// Feed querying with basic filters/pagination
export const findFeed = async (query, { page = 1, limit = 10 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    TimelinePost.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    TimelinePost.countDocuments(query),
  ]);

  return {
    items,
    total,
    page: Number(page),
    totalPages: Math.max(Math.ceil(total / Number(limit)), 1),
  };
};
