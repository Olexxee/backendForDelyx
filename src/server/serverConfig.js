import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { createServer } from "http";
import configRouter from "../routes/configRoute.js";
import chatRouter from "../routes/chatRoutes.js";
import { initSocketServer } from "../logic/socket/index.js";
import configService from "../lib/classes/configClass.js";
import { setIo } from "../logic/chats/chatController.js";
import { authRoute } from "../routes/authRoute.js";
import userRoute from "../routes/userRoutes.js";
import groupRouter from "../routes/groupRoutes.js";
import membershipRouter from "../routes/membershipRoute.js";
import tournamentRouter from "../routes/tournamentRoutes.js";
import participantRouter from "../routes/participantRoute.js";

const app = express();
const server = createServer(app);

app.disable("etag");

// -------------------------
// MIDDLEWARES
// -------------------------

// CORS configuration
const allowedOrigins = configService.get("ALLOWED_ORIGINS") || ["*"];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// Security headers
app.use(helmet());

// Compression for responses
app.use(compression());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser(configService.getOrThrow("COOKIE_SECRET")));

// -------------------------
// STATIC FILES
// -------------------------

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

let io;

(async () => {
  io = await initSocketServer(server);
  setIo(io);
})();

// -------------------------
// API VERSIONING
// -------------------------

const API_VERSION = "v1";
const apiBase = `/api/${API_VERSION}`;

app.use(`${apiBase}/auth`, authRoute);
app.use(`${apiBase}/profile`, userRoute);
// app.use(`${apiBase}/posts`, postRoute);
// app.use(`${apiBase}/stats`, statRoute);
app.use(`${apiBase}/groups`, groupRouter);
app.use(`${apiBase}/config`, configRouter);
app.use(`${apiBase}/membership`, membershipRouter);
app.use(`${apiBase}/tournaments`, tournamentRouter);
app.use(`${apiBase}/participants`, participantRouter);
app.use(`${apiBase}/chats`, chatRouter);

// -------------------------
// GLOBAL ERROR HANDLER
// -------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack || err.message || err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error",
  });
});

export { server };
