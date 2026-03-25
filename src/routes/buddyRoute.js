import logger from "../../lib/logger.js";
import express from "express";
import * as buddyController from "../../logic/buddyConnection/buddyConnectionController.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";

const buddyRouter = express.Router();

buddyRouter.post("/connect", authMiddleware, buddyController.sendBuddyRequest);


buddyRouter.post(
  "/accept/:connectionId",
  authMiddleware,
  buddyController.acceptConnection
);

buddyRouter.post(
  "/block/:userId",
  authMiddleware,
  buddyController.blockBuddyUser
);

buddyRouter.post(
  "/unblock/:userId",
  authMiddleware,
  buddyController.unblockBuddyUser
);

buddyRouter.delete(
  "/remove/:userId",
  authMiddleware,
  buddyController.removeBuddyConnection
);

buddyRouter.get("/list-connect", authMiddleware, buddyController.listBuddyConnections);

buddyRouter.get(
  "/connections/:requesterId/:recipientId",
  authMiddleware,
  buddyController.getConnectionDetailsController
);

export default buddyRouter;

// // routes/buddyConnection.routes.js
// import { Router } from "express";
// import {
//   sendBuddyRequest,
//   acceptBuddyRequest,
//   declineBuddyRequest,
//   blockBuddyUser,
//   removeBuddyConnection,
//   listBuddyConnections,
// } from "../logic/buddyConnection/buddyConnectionController.js";
// import { authMiddleware } from "../middlewares/authenticationMdw.js";

// const buddyRouter = Router();

// buddyRouter.use(authMiddleware);

// buddyRouter.post("/request/:userId", sendBuddyRequest);
// buddyRouter.post("/accept/:userId", acceptBuddyRequest);
// buddyRouter.post("/decline/:userId", declineBuddyRequest);
// buddyRouter.post("/block/:userId", blockBuddyUser);
// buddyRouter.delete("/:userId", removeBuddyConnection);
// buddyRouter.get("/", listBuddyConnections);

// export default buddyRouter;
