export default class ChatBroadcaster {
  constructor(io) {
    this.io = io;
  }

  broadcastMessage(chatRoomId, message) {
    this.io.to(chatRoomId).emit("chat:new_message", message);
  }

  notifyTyping(chatRoomId, userId, isTyping) {
    this.io.to(chatRoomId).emit("chat:user_typing", { userId, isTyping });
  }

  notifyRead(chatRoomId, userId) {
    this.io.to(chatRoomId).emit("chat:read", { chatRoomId, userId });
  }

  notifyDelivered(chatRoomId, userId) {
    this.io.to(chatRoomId).emit("chat:delivered", { chatRoomId, userId });
  }

  notifyDeletedForAll(chatRoomId, messageId) {
    this.io.to(chatRoomId).emit("chat:delete_for_everyone", { messageId });
  }
}