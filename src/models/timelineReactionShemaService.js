import logger from "../lib/logger.js";
import TimelineReaction from "./timelineReactionSchema.js";

export const upsertReaction = (data) =>
  TimelineReaction.findOneAndUpdate(
    { user: data.user, targetType: data.targetType, targetId: data.targetId },
    { $set: { type: data.type } },
    { upsert: true, new: true }
  );

export const removeReaction = (userId, targetType, targetId) =>
  TimelineReaction.findOneAndDelete({ user: userId, targetType, targetId });

export const hasReaction = (userId, targetType, targetId) =>
  TimelineReaction.findOne({ user: userId, targetType, targetId });
