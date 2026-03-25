import cloudinary from "./cloudinarySetup.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - The image buffer to upload
 * @param {Object} options
 * @param {string} options.folder - Cloudinary folder
 * @param {string} [options.publicId] - Optional public ID; auto-generated if not provided
 * @param {string} [options.resourceType="image"] - Resource type (image, video, raw)
 * @returns {Promise<{url, publicId, resourceType, format, bytes}>}
 */
export const uploadBufferToCloudinary = async ({
  buffer,
  folder,
  publicId,
  resourceType = "image",
}) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid buffer provided for Cloudinary upload.");
  }

  const finalPublicId = publicId || `${folder || "uploads"}/${uuidv4()}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: finalPublicId,
          resource_type: resourceType,
          overwrite: false, // avoids overwriting existing files
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
          });
        }
      )
      .end(buffer);
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId)
    throw new Error("Public ID is required to delete Cloudinary file.");
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("Cloudinary delete result:", result);
    return result;
  } catch (err) {
    console.error("Cloudinary delete failed:", err);
    throw err;
  }
};
