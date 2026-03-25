import * as postService from "../posts/postSchemaService.js";
import Post from "../posts/postSchema.js";
import * as userService from "../user/userService.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";
import configService from "../lib/classes/configClass.js";

export const createPost = async (payload) => {
  const post = await Post.create({
    user: payload.userId, // directly from req.user.id
    mediaType: payload.mediaType,
    mediaUrl: payload.mediaUrl,
    caption: payload.caption,
  });

  return post;
};

export const getPostById = async (payload) => {
  const post = await postService.findPostById({ id: payload.id });
  if (!post) {
    throw new NotFoundException("Post not found");
  }
  return post;
};

export const getPostByUsername = async (payload) => {
  const user = await userService.findUserByUsername({
    username: payload.username,
  });
  if (!user) {
    throw new NotFoundException("User not found");
  }

  const posts = await postService.getPostsByUser({ userId: user._id }); // 👈 or whatever your postService expects
  return posts;
};

export const getPostsByUsername = async ({ username }) => {
  const user = await userService.findUserByUsername({ username });
  if (!user) {
    throw new NotFoundException("User not found");
  }

  const posts = await postService.findPostsByUserId({ userId: user._id });
  if (!posts.length) throw new NotFoundException("No posts found");

  return posts;
};

export const deletePost = async (payload) => {
  const { postId, userId } = payload;

  if (!mongoose.isValidObjectId(postId)) {
    throw new NotFoundException("Invalid post ID");
  }

  const post = await postService.findPostById({ id: postId });

  if (!post) {
    throw new NotFoundException("Post not found");
  }

  // 🔐 Check if this post belongs to the user
  if (post.user.toString() !== userId) {
    throw new UnauthorizedException(
      "You do not have permission to delete this post"
    );
  }

  await postService.deletePost({ id: postId });

  return { message: "Post deleted successfully" };
};
