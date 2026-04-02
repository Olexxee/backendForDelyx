import express from "express";
import { authMiddleware } from "../middlewares/authenticationMdw.js";
import {
    getInbox,
    getConversationDetail,
} from "../logic/chats/conversationController.js";

const conversationRouter = express.Router();

conversationRouter.get("/inbox", authMiddleware, getInbox);
conversationRouter.get("/:chatRoomId", authMiddleware, getConversationDetail);

export default conversationRouter;