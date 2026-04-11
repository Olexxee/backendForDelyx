import * as groupHubService from "../groupLogic/groupHubService.js";
import { asyncWrapper } from "../lib/utils.js";

export const getGroupHub = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;

  const hub = await groupHubService.getGroupHub({
    groupId,
    userId: req.user._id,
  });

  res.set("Cache-Control", "no-store");
  res.status(200).json({
    success: true,
    data: hub,
  });
});
