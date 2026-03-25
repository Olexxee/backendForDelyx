import Post from "./postSchema.js";

// Create a new post
export const createPost = async (payload) => {
  return await Post.create(payload);
};

// Get a single post by ID
export const findPostById = async (payload) => {
  return await Post.findById(payload.id)
    .populate("user", "username email")
    .populate("comments.user", "username");
};

// Get all posts by user ID
export const findPostsByUserId = async (payload) => {
  return await Post.find({ user: payload.userId })
    .populate("user", "username email")
    .populate("comments.user", "username");
};

// Get all posts by username (must resolve user externally)
export const findPostsByUsername = async (payload) => {
  return await Post.find({ user: payload.userId }) // assumes user ID already fetched from username
    .populate("user", "username email")
    .populate("comments.user", "username");
};

// Update a post (e.g., for editing caption/media)
export const updatePost = async (payload) => {
  return await Post.findByIdAndUpdate(payload.id, payload, { new: true });
};

// Delete a post
export const deletePost = async (payload) => {
  return await Post.findByIdAndDelete(payload.id);
};
