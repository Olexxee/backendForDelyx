import { asyncWrapper } from "../../lib/utils.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";
import * as feedPostService from "./feedPostService.js";
import * as feedPostAccessService from "./feedPostAccessService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveUserId = (req) => req.user?._id ?? req.user?.id;

// ─── Create ───────────────────────────────────────────────────────────────────

export const createFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);

  await feedPostAccessService.assertCanCreatePostInContext({
    userId,
    contextType: req.body.contextType,
    contextId: req.body.contextId,
  });

  let mediaIds = Array.isArray(req.body.media) ? req.body.media : [];

  if (Array.isArray(req.files) && req.files.length > 0) {
    const uploadedMedia = await processUploadedMedia(
      req.files,
      "timeline",
      req.user,
      { resizeWidth: 1440, resizeHeight: 1440, quality: 85, minCount: 0 },
    );
    mediaIds = [...mediaIds, ...uploadedMedia.map((item) => item._id)];
  }

  const post = await feedPostService.createPost({
    author: userId,
    content: req.body.content,
    media: mediaIds,
    contextType: req.body.contextType,
    contextId: req.body.contextId,
    visibility: req.body.visibility,
  });

  return res.status(201).json({
    success: true,
    message: "Post created successfully.",
    data: post,
  });
});

export const getHomeFeed = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);

  const result = await feedPostService.getHomeFeed(userId, req.query);

  return res.status(200).json({
    success: true,
    ...result,
  });
});

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getFeedPostById = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId, {
    populate: [
      { path: "author", select: "username profilePicture" },
      { path: "media" },
    ],
  });

  await feedPostAccessService.assertCanViewPost({ userId, post });

  return res.status(200).json({ success: true, data: post });
});

export const getFeedPosts = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);

  const result = await feedPostService.getPostsForUser(userId, req.query, {
    populate: [{ path: "author", select: "username profilePicture" }],
  });

  return res.status(200).json({ success: true, ...result });
});

export const getPostsByContext = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { contextType, contextId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;

  const result = await feedPostService.getPostsByContextForUser(
    userId,
    { contextType, contextId, status },
    {
      page,
      limit,
      populate: [{ path: "author", select: "username profilePicture" }],
    },
  );

  return res.status(200).json({ success: true, ...result });
});

export const getPostsByAuthor = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { authorId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;

  const result = await feedPostService.getPostsByAuthorForUser(
    userId,
    { authorId, status },
    {
      page,
      limit,
      populate: [{ path: "author", select: "username profilePicture" }],
    },
  );

  return res.status(200).json({ success: true, ...result });
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const existingPost = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModifyPost({
    userId,
    post: existingPost,
  });

  let nextMedia = Array.isArray(req.body.media)
    ? req.body.media
    : existingPost.media;

  if (Array.isArray(req.files) && req.files.length > 0) {
    const uploadedMedia = await processUploadedMedia(
      req.files,
      "feed-post",
      req.user,
      { resizeWidth: 1440, resizeHeight: 1440, quality: 85, minCount: 0 },
    );
    nextMedia = [...nextMedia, ...uploadedMedia.map((item) => item._id)];
  }

  const updatedPost = await feedPostService.updatePost(postId, {
    content: req.body.content,
    media: nextMedia,
    visibility: req.body.visibility,
  });

  return res.status(200).json({
    success: true,
    message: "Post updated successfully.",
    data: updatedPost,
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const existingPost = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModifyPost({
    userId,
    post: existingPost,
  });

  const deletedPost = await feedPostService.softDeletePost(postId);

  return res.status(200).json({
    success: true,
    message: "Post deleted successfully.",
    data: deletedPost,
  });
});

// ─── Visibility ───────────────────────────────────────────────────────────────

export const hideFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanHideOwnPost({ userId, post });

  const updatedPost = await feedPostService.hidePost(postId);

  return res.status(200).json({
    success: true,
    message: "Post hidden successfully.",
    data: updatedPost,
  });
});

export const unhideFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanHideOwnPost({ userId, post });

  const updatedPost = await feedPostService.setFeedPostStatus(postId, "active");

  return res.status(200).json({
    success: true,
    message: "Post unhidden successfully.",
    data: updatedPost,
  });
});

// ─── Moderation ───────────────────────────────────────────────────────────────

export const flagFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanFlagPost({ userId, post });

  const updatedPost = await feedPostService.flagPost(postId);

  return res.status(200).json({
    success: true,
    message: "Post flagged successfully.",
    data: updatedPost,
  });
});

export const unflagFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModeratePost({ userId, post });

  const updatedPost = await feedPostService.setFeedPostStatus(postId, "active");

  return res.status(200).json({
    success: true,
    message: "Post unflagged successfully.",
    data: updatedPost,
  });
});

// ─── Pin / Feature ────────────────────────────────────────────────────────────

export const pinFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModeratePost({ userId, post });

  const updatedPost = await feedPostService.updatePost(postId, {
    isPinned: true,
  });

  return res.status(200).json({
    success: true,
    message: "Post pinned successfully.",
    data: updatedPost,
  });
});

export const unpinFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModeratePost({ userId, post });

  const updatedPost = await feedPostService.updatePost(postId, {
    isPinned: false,
  });

  return res.status(200).json({
    success: true,
    message: "Post unpinned successfully.",
    data: updatedPost,
  });
});

export const featureFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModeratePost({ userId, post });

  const updatedPost = await feedPostService.updatePost(postId, {
    isFeatured: true,
  });

  return res.status(200).json({
    success: true,
    message: "Post featured successfully.",
    data: updatedPost,
  });
});

export const unfeatureFeedPost = asyncWrapper(async (req, res) => {
  const userId = resolveUserId(req);
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModeratePost({ userId, post });

  const updatedPost = await feedPostService.updatePost(postId, {
    isFeatured: false,
  });

  return res.status(200).json({
    success: true,
    message: "Post unfeatured successfully.",
    data: updatedPost,
  });
});
