import multer from "multer";

// In-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Centralized media upload tunnel for app resources
 * @param {string} type
 */
export const handleMediaUpload = (type) => {
  switch (type) {
    case "catalog":
      return upload.fields([
        { name: "avatar", maxCount: 3 },
        { name: "banner", maxCount: 3 },
      ]);

    case "profile":
      return upload.fields([
        { name: "avatar", maxCount: 5 },
        { name: "banner", maxCount: 5 },
      ]);

    case "event":
      return upload.fields([
        { name: "avatar", maxCount: 10 },
        { name: "banner", maxCount: 10 },
      ]);

    case "store":
      return upload.fields([
        { name: "avatar", maxCount: 5 },
        { name: "banner", maxCount: 5 },
      ]);

    case "ask":
      return upload.fields([
        { name: "avatar", maxCount: 3 },
        { name: "banner", maxCount: 3 },
      ]);

    case "group":
      return upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "banner", maxCount: 1 },
      ]);

    case "timeline":
    case "feed-post":
      return upload.array("media", 10);

    default:
      return upload.none();
  }
};
