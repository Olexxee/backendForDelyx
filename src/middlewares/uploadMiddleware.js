import multer from "multer";

// In-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Centralized media upload tunnel for all app types
 * @param {string} type - "store" | "catalog" | "profile" | "event" | "group"
 */
export const handleMediaUpload = (type) => {
  let maxCount = 1; // default single file

  switch (type) {
    case "catalog":
      maxCount = 3;
      break;
    case "profile":
      maxCount = 5;
      break;
    case "event":
      maxCount = 10;
      break;
    case "store":
      maxCount = 5;
      break;
    case "ask":
      maxCount = 3;
      break;
    case "timeline":
      maxCount = 10;
      break;
    case "group":
      maxCount = 1; // Only one avatar or banner at a time
      break;
  }

  return upload.fields([
    { name: "avatar", maxCount: maxCount },
    { name: "banner", maxCount: maxCount },
  ]);
};
