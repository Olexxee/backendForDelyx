import { asyncWrapper } from "../../lib/utils.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";
import * as feedPostService from "./feedPostService.js";
import * as feedPostAccessService from "./feedPostAccessService.js";

export const createFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;

  await feedPostAccessService.assertCanCreatePostInContext({
    userId,
    contextType: req.body.contextType,
    contextId: req.body.contextId,
  });

  let mediaIds = Array.isArray(req.body.media) ? req.body.media : [];

  if (Array.isArray(req.files) && req.files.length > 0) {
    const uploadedMedia = await processUploadedMedia(
      req.files,
      "feed-post",
      req.user,
      {
        resizeWidth: 1440,
        resizeHeight: 1440,
        quality: 85,
        minCount: 0,
      },
    );

    const uploadedMediaIds = uploadedMedia.map((item) => item._id);
    mediaIds = [...mediaIds, ...uploadedMediaIds];
  }

  const post = await feedPostService.createPost({
    author: userId,
    content: req.body.content,
    media: mediaIds,
    contextType: req.body.contextType,
    contextId: req.body.contextId,
    visibility: req.body.visibility,
    status: req.body.status,
    isPinned: req.body.isPinned,
    isFeatured: req.body.isFeatured,
  });

  return res.status(201).json({
    success: true,
    message: "Post created successfully.",
    data: post,
  });
});

export const getFeedPostById = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id ?? null;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId, {
    populate: [
      { path: "author", select: "username profilePicture" },
      { path: "media" },
    ],
  });

  await feedPostAccessService.assertCanViewPost({ userId, post });

  return res.status(200).json({
    success: true,
    data: post,
  });
});

export const getFeedPosts = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id ?? null;

  const result = await feedPostService.getPostsForUser(userId, req.query, {
    populate: [{ path: "author", select: "username profilePicture" }],
  });

  return res.status(200).json({
    success: true,
    ...result,
  });
});

export const updateFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
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
      {
        resizeWidth: 1440,
        resizeHeight: 1440,
        quality: 85,
        minCount: 0,
      },
    );

    const uploadedMediaIds = uploadedMedia.map((item) => item._id);
    nextMedia = [...nextMedia, ...uploadedMediaIds];
  }

  const updatedPost = await feedPostService.updatePost(postId, {
    ...req.body,
    media: nextMedia,
  });

  return res.status(200).json({
    success: true,
    message: "Post updated successfully.",
    data: updatedPost,
  });
});

export const deleteFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
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

export const getPostsByContext = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id ?? null;
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

  return res.status(200).json({
    success: true,
    ...result,
  });
});

export const getPostsByAuthor = asyncWrapper(async (req, res) => {
  const { authorId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;

  const result = await feedPostService.getPostsByAuthor(
    { authorId, status },
    {
      page,
      limit,
      populate: [{ path: "author", select: "username profilePicture" }],
    },
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
});

export const hideFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModifyPost({ userId, post });

  await feedPostService.setFeedPostStatus(postId, "hidden");

  return res.status(200).json({
    success: true,
    message: "Post hidden successfully.",
  });
});

export const unhideFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanModifyPost({ userId, post });

  await feedPostService.setFeedPostStatus(postId, "active");

  return res.status(200).json({
    success: true,
    message: "Post unhidden successfully.",
  });
});

export const flagFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanViewPost({ userId, post });

  await feedPostService.setFeedPostStatus(postId, "flagged");

  return res.status(200).json({
    success: true,
    message: "Post flagged successfully.",
  });
});

export const unflagFeedPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanViewPost({ userId, post });

  await feedPostService.setFeedPostStatus(postId, "active");

  return res.status(200).json({
    success: true,
    message: "Post unflagged successfully.",
  });
});
