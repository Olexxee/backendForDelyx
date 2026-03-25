import Message from "./messageSchema.js";

export const getGroupWithLastMessage = async (groupId) => {
  const group = await Group.findById(groupId)
    .populate("chatRoom")
    .lean();

  if (!group) throw new Error("Group not found");

  const lastMessage = await Message.findOne({ chatRoom: group.chatRoom._id })
    .sort({ createdAt: -1 })
    .populate("sender", "username avatar")
    .lean();

  return {
    ...group,
    lastMessage: lastMessage
      ? { text: lastMessage.encryptedContent, sender: lastMessage.sender, createdAt: lastMessage.createdAt }
      : { text: "No messages yet" },
  };
};
