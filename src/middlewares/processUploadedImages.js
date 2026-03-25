import logger from "../lib/logger.js";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { uploadBufferToCloudinary } from "../config/cloudinaryService.js";
import mediaServerService from "../logic/upload/uploadService.js";

/**
 * Process uploaded files and store in Cloudinary
 * Automatically sets ownerId from req.user
 */
export const processUploadedMedia = async (
  files,
  type,
  user,
  {
    resizeWidth = 1080,
    resizeHeight = 1080,
    expiryDays = null,
    minCount = 0,
    quality = 80,
  } = {}
) => {
  if (!user || (!user.id && !user._id)) {
    throw new Error("Owner ID is required (user object missing)");
  }

  if (!Array.isArray(files) || files.length < minCount) {
    throw new Error(`At least ${minCount} file(s) required for "${type}"`);
  }

  const ownerId = user.id || user._id;
  const savedMedia = [];

  for (const file of files) {
    try {
      const publicId = `${type}/${uuidv4()}`;

      const buffer = await sharp(file.buffer)
        .resize({ width: resizeWidth, height: resizeHeight, fit: "cover" })
        .jpeg({ quality })
        .toBuffer();

      const uploaded = await uploadBufferToCloudinary({
        buffer,
        folder: type,
        publicId,
      });

      const expiresAt = expiryDays
        ? new Date(Date.now() + expiryDays * 86400000)
        : null;

      const mediaDoc = await mediaServerService.uploadMedia({
        ownerId,
        type,
        url: uploaded.url,
        storageProvider: "cloudinary",
        storagePath: uploaded.publicId,
        expiresAt,
        metadata: {
          size: uploaded.bytes,
          format: uploaded.format,
          mimeType: file.mimetype,
          originalName: file.originalname,
          width: resizeWidth,
          height: resizeHeight,
        },
      });

      savedMedia.push(mediaDoc);
    } catch (error) {
      logger.error("[Cloudinary] Upload failed", error);
      throw new Error(`Failed to process media: ${error.message}`);
    }
  }

  return savedMedia;
};
