import { Favorite } from "./FavoriteShema.js";
import mongoose from "mongoose";

export const create = (data) => Favorite.create(data);

export const findOne = (filter) => Favorite.findOne(filter);

export const deleteOne = (filter) => Favorite.findOneAndDelete(filter);

export const findByUser = (userId, postType = null) => {
  const filter = { userId: new mongoose.Types.ObjectId(userId) }; // must convert
  if (postType) filter.postType = postType;

  console.log("Mongo filter:", filter); // <-- debug
  return Favorite.find(filter).sort({ createdAt: -1 });
};

export const findAllByUser = (userId) => {
  const filter = { userId: new mongoose.Types.ObjectId(userId) };
  return Favorite.find(filter).sort({ createdAt: -1 });
};

// Count all favorites for a specific post
export const countByPost = (postId) => {
  return Favorite.countDocuments({ postId });
};

// Optional general count
export const count = (filter) => Favorite.countDocuments(filter);
