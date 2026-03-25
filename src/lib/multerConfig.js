import multer from "multer";
import path from "path";
import fs from "fs";

// Storage configuration using multer

//  To dynamically determine destination folder

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/others"; // fallback

    if (file.fieldname === "profilePicture") {
      folder = "uploads/profile_pictures";
    } else if (file.fieldname === "media") {
      folder = "uploads/posts";
    }

    // Ensure folder exists
    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

export default upload;
