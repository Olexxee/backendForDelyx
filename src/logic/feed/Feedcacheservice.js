import cacheManager from "../../lib/cacheManager.js";

const data = await cacheManager.get("some:key");

const FEED_MEMBERSHIP_TTL = 60; // seconds
const FEED_TOURNAMENT_TTL = 60; // seconds

const keys = {
  groupIds: (userId) => `feed:groups:${userId}`,
  tournamentIds: (userId) => `feed:tournaments:${userId}`,
};

// ─── Group ID Cache ───────────────────────────────────────────────────────────

/**
 * Returns cached group IDs for the user, or null if the cache is cold.
 * Callers receive plain string IDs — the query builder converts to ObjectId.
 *
 * @param {string} userId
 * @returns {Promise<string[] | null>}
 */
export const getCachedGroupIds = async (userId) => {
  try {
    const raw = await cacheManager.get(keys.groupIds(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // Cache read failure is non-fatal — fall through to DB
    return null;
  }
};

/**
 * @param {string}   userId
 * @param {string[]} groupIds  - Array of plain string IDs
 */
export const setCachedGroupIds = async (userId, groupIds) => {
  try {
    await cacheManager.set(keys.groupIds(userId), JSON.stringify(groupIds), {
      EX: FEED_MEMBERSHIP_TTL,
    });
  } catch {
    // Cache write failure is non-fatal
  }
};

/**
 * Invalidate when the user's membership changes (join, leave, kicked).
 * Call this from membershipService after any status mutation.
 *
 * @param {string} userId
 */
export const invalidateCachedGroupIds = async (userId) => {
  try {
    await cacheManager.delete(keys.groupIds(userId));
  } catch {
    // Non-fatal
  }
};

// ─── Tournament ID Cache ──────────────────────────────────────────────────────

/**
 * @param {string} userId
 * @returns {Promise<string[] | null>}
 */
export const getCachedTournamentIds = async (userId) => {
  try {
    const raw = await cacheManager.get(keys.tournamentIds(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * @param {string}   userId
 * @param {string[]} tournamentIds
 */
export const setCachedTournamentIds = async (userId, tournamentIds) => {
  try {
    await cacheManager.set(
      keys.tournamentIds(userId),
      JSON.stringify(tournamentIds),
      { EX: FEED_TOURNAMENT_TTL },
    );
  } catch {
    // Non-fatal
  }
};

/**
 * Invalidate when the user's tournament participation changes.
 * Call this from tournamentService after registration/removal.
 *
 * @param {string} userId
 */
export const invalidateCachedTournamentIds = async (userId) => {
  try {
    await cacheManager.deletes(keys.tournamentIds(userId));
  } catch {
    // Non-fatal
  }
};
