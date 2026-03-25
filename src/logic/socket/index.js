import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { pubClient, subClient, connectRedis } from "./redisClient.js";
import { socketAuthMiddleware } from "./socketAuth.js";
import { registerSocket, unregisterSocket } from "./socketRegistry.js";
import { registerChatEvents } from "../chats/chatEvent.js";
import { setIo } from "./socketInstance.js";

export const initSocketServer = async (httpServer) => {
  // ---------------------------------------
  // 1. CREATE SOCKET SERVER
  // ---------------------------------------
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  setIo(io);

  // ---------------------------------------
  // 2. REDIS ADAPTER (FOR SCALING)
  // ---------------------------------------
  await connectRedis();

  io.adapter(createAdapter(pubClient, subClient));

  console.info("✅ Redis adapter connected");

  // ---------------------------------------
  // 3. AUTHENTICATION MIDDLEWARE
  // ---------------------------------------
  io.use(socketAuthMiddleware);

  // ---------------------------------------
  // 4. CONNECTION HANDLER
  // ---------------------------------------
  io.on("connection", async (socket) => {
    const userId = socket.user?.id;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.info(`[Socket] User ${userId} connected (${socket.id})`);

    try {
      await registerSocket(userId, socket.id);
      registerChatEvents(io, socket);
    } catch (err) {
      console.error("❌ Socket setup error:", err);
      socket.disconnect(true);
      return;
    }

    // -----------------------------------
    // DISCONNECT HANDLER
    // -----------------------------------
    socket.on("disconnect", async () => {
      try {
        await unregisterSocket(userId, socket.id);
        console.info(`[Socket] User ${userId} disconnected (${socket.id})`);
      } catch (err) {
        console.error("❌ Socket cleanup error:", err);
      }
    });
  });

  return io;
};
