import logger from "../../lib/logger.js";
import mediaService from "../../models/mediaSchemaService.js";
import {
  ForbiddenError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import { deleteFromCloudinary } from "../../config/cloudinaryService.js";

const mediaServerService = {
  /**
   * Upload and persist media
   */
  async uploadMedia({
    ownerId,
    type,
    url,
    role,
    storageProvider,
    storagePath,
    expiresAt,
    metadata,
  }) {
    if (!ownerId) {
      throw new Error("Owner ID is required");
    }

    return mediaService.createMedia({
      owner: ownerId,
      type,
      url,
      role,
      storageProvider,
      storagePath,
      expiresAt,
      metadata,
    });
  },

  /**
   * Retrieve media by ID
   */
  async getMediaById(user, mediaId) {
    const media = await mediaService.getMediaById(mediaId);
    if (!media) throw new NotFoundException("Media not found");

    if (!media.owner.equals(user._id) && !user.isAdmin) {
      throw new ForbiddenError("Not authorized to access this media");
    }

    return media;
  },

  /**
   * Retrieve user media
   */
  async getUserMedia(user, type) {
    if (user.isAdmin) {
      return mediaService.getUserMedia(undefined, type);
    }
    return mediaService.getUserMedia(user._id, type);
  },

  /**
   * Replace media (upload new → delete old)
   */
  async replaceMedia({ user, files, type, oldMediaId, expiresAt }) {
    const newMedia = await this.uploadMedia({
      user,
      files,
      type,
      expiresAt,
    });

    if (oldMediaId) {
      await this.deleteMedia(user, [oldMediaId]);
    }

    return newMedia;
  },

  /**
   * Delete media (Cloudinary + DB)
   */
  async deleteMedia(user, mediaIds = []) {
    if (!mediaIds.length) return;

    await Promise.all(
      mediaIds.map(async (mediaId) => {
        const media = await mediaService.getMediaById(mediaId);
        if (!media) return;

        if (!media.owner.equals(user._id) && !user.isAdmin) {
          throw new ForbiddenError("Not authorized to delete this media");
        }

        if (media.storageProvider === "cloudinary" && media.storagePath) {
          await deleteFromCloudinary(media.storagePath);
        }

        await mediaService.deleteMediaById(mediaId);
      })
    );
  },
};

export default mediaServerService;
