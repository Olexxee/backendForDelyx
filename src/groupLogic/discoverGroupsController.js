import { discoverGroups } from "./discoverGroupsService.js";
import { BadRequestError } from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";

/**
 * GET /api/groups/discover
 * Query Params:
 *  - page: number (default 1)
 *  - limit: number (default 20)
 */
export const getDiscoverGroups = asyncWrapper(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  if (page < 1 || limit < 1) {
    throw new BadRequestError("Page and limit must be positive numbers");
  }

  const groups = await discoverGroups({
    currentUserId: req.user._id,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: groups,
    page,
    limit,
    total: groups.length,
  });
});
