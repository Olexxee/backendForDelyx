export const normalizeMultipartFeedPostBody = (req, res, next) => {
  const body = req.body ?? {};

  // content
  if (typeof body.content !== "string") {
    body.content = "";
  } else {
    body.content = body.content.trim();
  }

  // media: multipart sends strings
  if (body.media == null || body.media === "") {
    body.media = [];
  } else if (Array.isArray(body.media)) {
    body.media = body.media.filter(Boolean);
  } else if (typeof body.media === "string") {
    try {
      const parsed = JSON.parse(body.media);
      body.media = Array.isArray(parsed)
        ? parsed.filter(Boolean)
        : [body.media];
    } catch {
      body.media = [body.media].filter(Boolean);
    }
  } else {
    body.media = [];
  }

  // contextType
  if (typeof body.contextType !== "string" || !body.contextType.trim()) {
    body.contextType = "general";
  } else {
    body.contextType = body.contextType.trim();
  }

  // contextId
  if (
    body.contextId === undefined ||
    body.contextId === null ||
    body.contextId === "" ||
    body.contextId === "null"
  ) {
    body.contextId = null;
  } else {
    body.contextId = String(body.contextId).trim();
  }

  // visibility
  if (typeof body.visibility !== "string" || !body.visibility.trim()) {
    body.visibility = "public";
  } else {
    body.visibility = body.visibility.trim();
  }

  req.body = body;
  next();
};
