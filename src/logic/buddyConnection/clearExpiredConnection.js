import logger from "../../lib/logger.js";
import cron from "node-cron";
import buddyConnectionDb from "../models/buddyConnectionSchemaService.js";
import * as userService from "../user/userService.js";

export default function expiredBuddyCleanupJob() {
  cron.schedule("0 0 * * *", async () => {
    try {
      logger.info("[Cron] Starting expired buddy connection cleanup...");

      const now = new Date();
      const expiredConnections = await buddyConnectionDb.findConnections({
        status: "pending",
        expiresAt: { $lt: now },
      });

      let deletedCount = 0;
      let extendedCount = 0;

      for (const conn of expiredConnections) {
        const requester = await userService.findUserById(conn.requester);

        if (!requester?.isPremium) {
          await buddyConnectionDb.deleteConnection({ _id: conn._id });
          deletedCount++;
        } else {
          // Premium user: extend expiry by 7 days
          conn.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          await conn.save();
          extendedCount++;
        }
      }

      logger.info(
        `[Cron] Cleanup complete. Deleted: ${deletedCount}, Extended: ${extendedCount}`
      );
    } catch (err) {
      logger.error(
        "[Cron] Error during expired buddy connection cleanup:",
        err
      );
    }
  });
}
