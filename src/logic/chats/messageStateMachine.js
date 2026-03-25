export const MessageStates = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  SOFT_DELETED: "soft_deleted",
  HARD_DELETED: "hard_deleted",
};

export const canRead = (message, userId) => {
  if (message.isDeleted) return false;
  if (message.deletedFor?.includes(userId)) return false;
  return true;
};

export const canDeleteForEveryone = (message, user) => {
  return message.sender.toString() === user._id.toString() || user.isAdmin;
};

export const canSoftDelete = (message, userId) => {
  return !message.deletedFor?.includes(userId);
};
