import mongoose from "mongoose";
import * as favoriteCrud from "../../models/favoriteSchemaService.js";
import { fetchExtraInfo } from "./fetchExtraInfo.js";

/**
 * Hydrate a favorite with its post details and total favorites
 */
export const hydrateFavorite = async (fav) => {
  // Convert Mongoose document to plain object if needed
  const favorite = fav.toObject ? fav.toObject() : fav;

  let { postId, postType } = favorite;

  // Validation
  if (!postId || !postType) {
    console.log("Hydrate failed: missing fields", favorite);
    return null; // return null so we can filter later
  }

  // Convert postId to ObjectId if needed
  if (!mongoose.isValidObjectId(postId)) {
    try {
      postId = new mongoose.Types.ObjectId(postId);
    } catch (err) {
      console.log("Invalid postId for hydrateFavorite:", postId);
      return null;
    }
  }

  // Fetch the actual post / item details
  const post = await fetchExtraInfo(postId, postType);

  if (!post) {
    return {
      ...favorite,
      post: null,
      totalFavorites: 0,
    };
  }

  // Count total favorites for this post
  const totalFavorites = await favoriteCrud.count({ postId, postType });

  return {
    ...favorite,
    post,
    totalFavorites,
  };
};
