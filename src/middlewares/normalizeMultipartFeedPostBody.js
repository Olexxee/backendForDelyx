const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  if (value === "true") return true;
  if (value === "false") return false;

  return value;
};

const parseNullable = (value) => {
  if (value === "" || value === "null" || value === undefined) {
    return null;
  }

  return value;
};

const parseArray = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
};

export const normalizeMultipartFeedPostBody = (req, _res, next) => {
  if (!req.body) {
    req.body = {};
  }

  req.body.content =
    typeof req.body.content === "string" ? req.body.content.trim() : "";

  req.body.contextType = req.body.contextType || "general";
  req.body.contextId = parseNullable(req.body.contextId);
  req.body.visibility = req.body.visibility || "public";
  req.body.status = req.body.status || "active";

  req.body.isPinned = parseBoolean(req.body.isPinned ?? false);
  req.body.isFeatured = parseBoolean(req.body.isFeatured ?? false);

  // Optional existing media IDs passed from client
  req.body.media = parseArray(req.body.media).filter(Boolean);

  next();
};
