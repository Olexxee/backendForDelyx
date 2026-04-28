import mongoose from "mongoose";
import FeedPost from "../../models/feedPostSchema.js";
import Membership from "../../groupLogic/membershipSchema.js";
import Tournament from "../../models/tournamentSchema.js";
import { normalizeListOptions } from "../../lib/list.js";
import {
  getCachedGroupIds,
  setCachedGroupIds,
  getCachedTournamentIds,
  setCachedTournamentIds,
} from "./feedCacheService.js";

const { Types } = mongoose;

// ─── ObjectId Helpers ─────────────────────────────────────────────────────────

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

const uniqueObjectIds = (values = []) => {
  const map = new Map();
  for (const value of values) {
    const id = toObjectId(value);
    if (id) map.set(id.toString(), id);
  }
  return [...map.values()];
};

// ─── Membership / Participation Lookups (with cache) ─────────────────────────

const getVisibleGroupIdsForUser = async (userId, { session } = {}) => {
  const normalizedUserId = toObjectId(userId);
  if (!normalizedUserId) return [];

  const userIdStr = normalizedUserId.toString();

  // Cache is skipped when inside a session (transaction context needs live data)
  if (!session) {
    const cached = await getCachedGroupIds(userIdStr);
    if (cached !== null) {
      return uniqueObjectIds(cached);
    }
  }

  let query = Membership.find({
    userId: normalizedUserId,
    status: "active",
  }).select("groupId");

  if (session) query = query.session(session);

  const memberships = await query.lean();
  const ids = uniqueObjectIds(memberships.map((m) => m.groupId));

  if (!session) {
    // Fire-and-forget — don't hold up the query for a cache write
    setCachedGroupIds(
      userIdStr,
      ids.map((id) => id.toString()),
    ).catch(() => {});
  }

  return ids;
};

const getVisibleTournamentIdsForUser = async (userId, { session } = {}) => {
  const normalizedUserId = toObjectId(userId);
  if (!normalizedUserId) return [];

  const userIdStr = normalizedUserId.toString();

  if (!session) {
    const cached = await getCachedTournamentIds(userIdStr);
    if (cached !== null) {
      return uniqueObjectIds(cached);
    }
  }

  let query = Tournament.find({
    "participants.userId": normalizedUserId,
    "participants.status": { $in: ["registered", "approved", "active"] },
  }).select("_id");

  if (session) query = query.session(session);

  const tournaments = await query.lean();
  const ids = uniqueObjectIds(tournaments.map((t) => t._id));

  if (!session) {
    setCachedTournamentIds(
      userIdStr,
      ids.map((id) => id.toString()),
    ).catch(() => {});
  }

  return ids;
};

// ─── Filter Sanitization ──────────────────────────────────────────────────────

const PAGINATION_KEYS = [
  "page",
  "limit",
  "skip",
  "sort",
  "populate",
  "select",
  "session",
  "lean",
];

const sanitizeFeedFilters = (filters = {}) => {
  const cleaned = { ...filters };

  for (const key of PAGINATION_KEYS) delete cleaned[key];

  if (!cleaned.status) cleaned.status = "active";

  if (cleaned.author) {
    const authorId = toObjectId(cleaned.author);
    if (authorId) cleaned.author = authorId;
    else delete cleaned.author;
  }

  if (cleaned.contextId) {
    const contextId = toObjectId(cleaned.contextId);
    if (contextId) cleaned.contextId = contextId;
    else delete cleaned.contextId;
  }

  if (typeof cleaned.isPinned !== "boolean") delete cleaned.isPinned;
  if (typeof cleaned.isFeatured !== "boolean") delete cleaned.isFeatured;

  return cleaned;
};

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Builds a MongoDB query object for the feed, incorporating visibility rules
 * based on the requesting user's group memberships and tournament participation.
 *
 * The top-level `status` filter (defaulting to "active") is applied alongside
 * the $or visibility clauses — MongoDB requires both conditions to be satisfied,
 * so the `{ author: normalizedUserId }` clause does NOT bypass the status filter.
 * This is intentional: own-post visibility is unrestricted by group/tournament
 * membership, but deleted posts are still excluded for everyone including authors.
 * If you ever need authors to see their own deleted posts, move the author clause
 * into a separate top-level $and rather than removing the status default.
 *
 * @param {{ userId: string, filters?: object, session?: ClientSession }} params
 * @returns {Promise<object>} Mongo query object ready for FeedPost.find()
 */
export const buildFeedQuery = async ({
  userId,
  filters = {},
  session = null,
}) => {
  const normalizedUserId = toObjectId(userId);
  const sanitizedFilters = sanitizeFeedFilters(filters);

  const [visibleGroupIds, visibleTournamentIds] = await Promise.all([
    getVisibleGroupIdsForUser(normalizedUserId, { session }),
    getVisibleTournamentIdsForUser(normalizedUserId, { session }),
  ]);

  const visibilityClauses = [{ visibility: "public" }];

  if (normalizedUserId) {
    // Author sees all their own posts regardless of visibility setting,
    // but top-level status filter still applies (no deleted post bypass).
    visibilityClauses.push({ author: normalizedUserId });

    visibilityClauses.push({
      visibility: "private",
      author: normalizedUserId,
    });

    if (visibleGroupIds.length > 0) {
      visibilityClauses.push({
        visibility: "group_members",
        contextType: "group",
        contextId: { $in: visibleGroupIds },
      });
    }

    if (visibleTournamentIds.length > 0) {
      visibilityClauses.push({
        visibility: "tournament_participants",
        contextType: "tournament",
        contextId: { $in: visibleTournamentIds },
      });
    }
  }

  return {
    ...sanitizedFilters,
    $or: visibilityClauses,
  };
};

// ─── Feed Query Execution ─────────────────────────────────────────────────────

/**
 * Fetches a paginated feed for a given user, respecting all visibility rules.
 *
 * @param {string} userId
 * @param {object} filters  - Field filters (author, contextType, status, etc.)
 * @param {object} options  - Pagination/query options (page, limit, sort, etc.)
 */
export const findFeedPostsForUser = async (
  userId,
  filters = {},
  options = {},
) => {
  const { page, limit, sort, select, populate, session, lean, skip } =
    normalizeListOptions(options);

  const finalQuery = await buildFeedQuery({ userId, filters, session });

  let itemsQuery = FeedPost.find(finalQuery).sort(sort).skip(skip).limit(limit);

  if (select) itemsQuery = itemsQuery.select(select);
  if (populate) itemsQuery = itemsQuery.populate(populate);
  if (session) itemsQuery = itemsQuery.session(session);
  if (lean) itemsQuery = itemsQuery.lean();

  let totalQuery = FeedPost.countDocuments(finalQuery);
  if (session) totalQuery = totalQuery.session(session);

  const [items, total] = await Promise.all([itemsQuery, totalQuery]);

  return {
    items,
    total,
    page,
    limit,
    // Return 0 when there are no results so the frontend
    // doesn't show "page 1 of 1" on an empty feed.
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
};
