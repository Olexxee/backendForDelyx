import * as postService from "../postController/postService.js";
import * as userService from "../user/userService.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";
import { postSchema } from "./postRequest.js";

export const createPost = asyncWrapper(async (req, res) => {
  try {
    const mediaUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : req.body.mediaUrl;

    const payload = {
      mediaType: req.body.mediaType,
      mediaUrl,
      caption: req.body.caption,
      userId: req.user.id,
    };

    const validator = new ValidatorClass();
    validator.validate(postSchema, payload);

    const post = await postService.createPost(payload);
    res.status(201).json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Post creation error:", error);
    throw new BadRequestError("Invalid request data");
  }
});

export const getPostsByUser = asyncWrapper(async (req, res) => {
  const { username } = req.query;

  if (!username) {
    throw new BadRequestError("Username is required");
  }

  const user = await userService.getUserByUsername(username);

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const posts = await postService.findPostsByUserId({ userId: user._id });

  if (!posts || posts.length === 0) {
    throw new NotFoundException("No posts found for this user");
  }

  res.status(200).json({
    success: true,
    posts,
  });
});

export const deletePost = asyncWrapper(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  const result = await postService.deletePost({ postId, userId });

  res.status(200).json({
    success: true,
    ...result,
  });
});
