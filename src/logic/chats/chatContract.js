export const ChatEvents = {
  JOIN: "chat:join",
  LEAVE: "chat:leave",
  SEND: "chat:send",
  NEW_MESSAGE: "chat:new_message",
  FETCH_MESSAGES: "chat:fetch_messages",
  READ: "chat:read",
  DELIVERED: "chat:delivered",
  DELETE_SOFT: "chat:delete",
  DELETE_HARD: "chat:delete_for_everyone",
  USER_TYPING: "chat:user_typing",
};

// Payload shapes
export const SendMessagePayload = {
  chatRoomId: "string (ObjectId)",
  content: "string?",
  mediaIds: "string[]?",
};

export const FetchMessagesPayload = {
  chatRoomId: "string (ObjectId)",
  limit: "number?",
  skip: "number?",
};

export const ChatMessageDTO = {
  _id: "string (ObjectId)",
  chatRoom: "string (ObjectId)",
  sender: {
    _id: "string",
    username: "string",
    firstName: "string",
    lastName: "string",
    profilePicture: "string?",
  },
  content: "string",
  media: "array",
  createdAt: "Date",
  deliveredTo: "string[]",
  readBy: "string[]",
  isDeleted: "boolean",
  deletedFor: "string[]",
};
