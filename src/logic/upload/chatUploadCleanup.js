import logger from "../../lib/logger.js";
import cron from "node-cron";
import mediaService from "../../models/mediaSchemaService.js";
import { deleteFileFromFirebase } from "../../config/firebaseService.js";

// Mark expired files
async function markExpiredMedia() {
  const expired = await mediaService.getExpiredMedia();
  for (const media of expired) {
    await mediaService.markExpired(media._id);
    logger.info(`[CRON] Marked media as expired: ${media._id}`);
  }
}

// Delete already marked files
async function deleteMarkedMedia() {
  const now = new Date();
  const markedMedia = await mediaService.findMarkedBefore(now);

  for (const media of markedMedia) {
    if (media.firebasePath) {
      await deleteFileFromFirebase(media.firebasePath);
    }
    await mediaService.deleteMediaById(media._id);
    logger.info(`[CRON] Deleted expired media: ${media._id}`);
  }

  logger.info(`[CRON] Deleted ${markedMedia.length} expired media items`);
}

// Schedule marking every hour
cron.schedule("0 * * * *", markExpiredMedia);

// Schedule deletion every night at 2 AM
cron.schedule("0 2 * * *", deleteMarkedMedia);
