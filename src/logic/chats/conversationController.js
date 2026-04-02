import conversationService from "./conversationService.js";
import { asyncWrapper } from "../lib/utils.js";

export const getInbox = asyncWrapper(async (req, res) => {
  const result = await conversationService.getInboxForUser({
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getConversationDetail = asyncWrapper(async (req, res) => {
  const result = await conversationService.getConversationDetail({
    chatRoomId: req.params.chatRoomId,
    userId: req.user._id,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});