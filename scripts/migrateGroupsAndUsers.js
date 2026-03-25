import mongoose from "mongoose";

import Group from "../src/groupLogic/groupSchema.js";
import ChatRoom from "../src/models/chatRoomSchema.js";
import User from "../src/user/userSchema.js";
import Membership from "../src/groupLogic/membershipSchema.js";
import { generateRoomKey } from "../src/logic/chats/chatRoomKeyService.js";

// IMPORTANT: ensure Media schema is registered
import "../src/models/mediaSchema.js";

async function migrateGroupsAndUsers() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  /* --------------------------------------------------
   * 1️⃣ FIX GROUPS (aesKey + chatRoom)
   * -------------------------------------------------- */

  const groups = await Group.find({});
  console.log(`🔎 Found ${groups.length} groups total`);

  for (const group of groups) {
    try {
      let groupModified = false;

      // ✅ Ensure group has aesKey
      if (!group.aesKey) {
        const key = generateRoomKey();
        if (!key || !Buffer.isBuffer(key)) {
          throw new Error("Failed to generate group AES key");
        }

        group.aesKey = key.toString("hex");
        groupModified = true;
      }

      // ✅ Sanitize avatar (ObjectId only)
      if (group.avatar && !mongoose.Types.ObjectId.isValid(group.avatar)) {
        group.avatar = undefined;
        groupModified = true;
      }

      // ✅ Create chatRoom if missing
      if (!group.chatRoom) {
        const members = await Membership.find({
          groupId: group._id,
        }).select("userId");

        const chatRoom = await ChatRoom.create({
          contextType: "group",
          contextId: group._id,
          participants: members.map((m) => m.userId),
          encryptionVersion: 1,
          lastMessageAt: null,
        });

        group.chatRoom = chatRoom._id;
        groupModified = true;
      }

      if (groupModified) {
        await group.save();
      }

      console.log(`✅ Group fixed: "${group.name}"`);
    } catch (err) {
      console.error(`❌ Failed to fix group "${group.name}"`, err);
    }
  }

  /* --------------------------------------------------
   * 2️⃣ FIX USER GROUP CACHES
   * -------------------------------------------------- */

  const users = await User.find({});
  console.log(`🔎 Found ${users.length} users to update`);

  for (const user of users) {
    try {
      const serializedGroups = [];

      for (const entry of user.groups || []) {
        const groupId =
          typeof entry === "string" || entry instanceof mongoose.Types.ObjectId
            ? entry
            : entry.id;

        if (!mongoose.Types.ObjectId.isValid(groupId)) continue;

        const group = await Group.findById(groupId)
          .populate("avatar createdBy")
          .lean();

        if (!group) continue;

        serializedGroups.push({
          id: group._id.toString(),
          name: group.name,
          bio: group.bio || null,
          avatar: group.avatar?.url || null,
          privacy: group.privacy,
          joinCode: group.joinCode || null,
          createdBy: group.createdBy?._id?.toString() || null,
          createdByName: group.createdBy?.username || null,
          isActive: group.isActive,
          totalMembers: group.totalMembers || 1,
          tournamentsCount: group.tournamentsCount || 0,
          activeTournamentsCount: group.activeTournamentsCount || 0,
          chatRoomId: group.chatRoom?.toString() || null,
          lastTournamentAt: group.lastTournamentAt || null,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        });
      }

      user.groups = serializedGroups;
      await user.save();

      console.log(`✅ Updated user ${user.username}`);
    } catch (err) {
      console.error(`❌ Failed to update user ${user.username}`, err);
    }
  }

  console.log("🎉 Migration complete");
  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
}

migrateGroupsAndUsers().catch((err) => {
  console.error("🔥 Migration failed:", err);
  process.exit(1);
});
