/**
 * Normalizes pagination/query options into a consistent shape.
 * Used by DAL functions and feed query builders across the app.
 *
 * @param {object} options
 * @returns {{ page, limit, sort, select, populate, session, lean, skip }}
 */
export const normalizeListOptions = (options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select = null,
    populate = null,
    session = null,
    lean = true,
  } = options;

  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.max(Number(limit) || 20, 1);
  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    sort,
    select,
    populate,
    session,
    lean,
    skip,
  };
};
