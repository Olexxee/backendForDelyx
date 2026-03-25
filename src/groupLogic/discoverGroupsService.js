import Group from "../groupLogic/groupSchema.js";
import mongoose from "mongoose";

export const discoverGroups = async ({
  currentUserId,
  page = 1,
  limit = 20,
}) => {
 if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
  throw new BadRequestError("Invalid currentUserId");
}
  const skip = (page - 1) * limit;

  return Group.find({
    privacy: "public",
    isActive: true,
    createdBy: { $ne: currentUserId },
  })
    .sort({ communityScore: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};
