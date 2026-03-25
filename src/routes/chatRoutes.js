import { Router } from "express";
import multer from "multer";
import * as chatController from "../logic/chats/chatController.js";
import { authMiddleware } from "../middlewares/authenticationMdw.js";
import { validateBody } from "../middlewares/validatorMiddleware.js";
import { sendMessageSchema } from "../logic/chats/chatRequest.js";

const chatRouter = Router();

/**
 * =============================
 * MULTER CONFIG (Memory Storage)
 * =============================
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

/**
 * =============================
 * AUTHENTICATION
 * =============================
 */
chatRouter.use(authMiddleware);

/**
 * =============================
 * CHAT ROOM ROUTES
 * =============================
 */
chatRouter.get("/context/:contextType/:contextId", chatController.getChatRoom);
chatRouter.get("/rooms", chatController.getUserChatRooms);

/**
 * AES Key for end-to-end encryption
 */
chatRouter.get("/room/:chatRoomId/key", chatController.getAesKey);

/**
 * =============================
 * MESSAGES ROUTES
 * =============================
 */
chatRouter.get("/room/:chatRoomId/messages", chatController.getMessages);
chatRouter.get("/room/:chatRoomId/sync", chatController.syncMessages);

chatRouter.post(
  "/room/:chatRoomId/messages",
  upload.array("media", 5),
  validateBody(sendMessageSchema),
  chatController.sendMessage
);

/**
 * =============================
 * MESSAGE DELETION ROUTES
 * =============================
 */
chatRouter.delete("/messages/:messageId", chatController.deleteMessage);
chatRouter.delete(
  "/messages/:messageId/everyone",
  chatController.deleteMessageForEveryone
);

export default chatRouter;
