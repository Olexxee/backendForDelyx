import mongoose from "mongoose";
import User from "../src/user/userSchema.js";
import Group from "../src/groupLogic/groupSchema.js";

const MONGO_URI = process.env.MONGO_URI;

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const users = await User.find();
  console.log(`🔎 Found ${users.length} users`);

  for (const user of users) {
    const resolvedGroupIds = new Set();

    for (const entry of user.groups || []) {
      if (mongoose.Types.ObjectId.isValid(entry)) {
        resolvedGroupIds.add(entry);
        continue;
      }

      const group = await Group.findOne({ name: entry });
      if (group) {
        resolvedGroupIds.add(group._id.toString());
      } else {
        console.warn(
          `⚠️ Group not found for name "${entry}" (user: ${user.email})`,
        );
      }
    }

    user.groups = Array.from(resolvedGroupIds).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    await user.save({ validateBeforeSave: false });
    console.log(`✅ Migrated user ${user.email}`);
  }

  console.log("Migration complete");
  process.exit(0);
};

run().catch((err) => {
  console.error("Migration failed", err);
  process.exit(1);
});
