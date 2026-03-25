import express from "express";
import multer from "multer";
import { processUploadedMedia } from "../middleware/mediaHandler.js";
import * as chatService from "../logic/chats/chatService.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"));
    }
  },
});

/**
 * REST endpoint: Upload chat media
 * POST /api/chat/upload
 */
router.post(
  "/upload",
  authenticate,
  upload.array("media", 5), // Max 5 files
  async (req, res, next) => {
    try {
      // Process uploaded files
      const mediaDocuments = await processUploadedMedia(req, "chat", {
        resizeWidth: 1200,
        resizeHeight: 1200,
        expiryDays: null, // Chat media doesn't expire
        minCount: 1,
        quality: 85,
      });

      // Extract media IDs
      const mediaIds = mediaDocuments.map((doc) => doc._id);

      res.status(200).json({
        success: true,
        message: "Media uploaded successfully",
        data: {
          mediaIds,
          media: mediaDocuments,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * REST endpoint: Send message with media
 * POST /api/chat/message
 */
router.post("/message", authenticate, async (req, res, next) => {
  try {
    const { chatRoomId, content, mediaIds = [] } = req.body;
    
    // Create a broadcaster instance for this REST request
    const broadcaster = new ChatBroadcaster(io);

    const message = await chatService.createMessage({
      chatRoomId,
      senderId: req.user.id,
      content,
      mediaIds,
      broadcaster, // Now REST messages will also trigger Socket events!
    });

    res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CLIENT-SIDE USAGE EXAMPLES
// ============================================

/**
 * Example 1: Upload media first, then send message via Socket.IO
 */
async function sendMessageWithMedia(chatRoomId, content, files) {
  // Step 1: Upload media files
  const formData = new FormData();
  files.forEach((file) => formData.append("media", file));

  const uploadResponse = await fetch("/api/chat/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const { data } = await uploadResponse.json();
  const mediaIds = data.mediaIds;

  // Step 2: Send message via Socket.IO with media IDs
  socket.emit(
    "chat:send",
    {
      chatRoomId,
      content,
      mediaIds,
    },
    (response) => {
      if (response.success) {
        console.log("Message sent:", response.message);
      } else {
        console.error("Failed to send:", response.error);
      }
    }
  );
}

/**
 * Example 2: Direct REST API approach (upload + send in one request)
 */
async function sendMessageREST(chatRoomId, content, mediaIds) {
  const response = await fetch("/api/chat/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatRoomId,
      content,
      mediaIds,
    }),
  });

  return response.json();
}

/**
 * Example 3: Complete chat flow with React
 */
function ChatMessageForm({ chatRoomId, socket }) {
  const [content, setContent] = React.useState("");
  const [files, setFiles] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setUploading(true);
      let mediaIds = [];

      // Upload files if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => formData.append("media", file));

        const response = await fetch("/api/chat/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const result = await response.json();
        mediaIds = result.data.mediaIds;
      }

      // Send message via socket
      socket.emit(
        "chat:send",
        { chatRoomId, content, mediaIds },
        (response) => {
          if (response.success) {
            setContent("");
            setFiles([]);
          } else {
            alert("Failed to send message");
          }
        }
      );
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
      />
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />
      <button type="submit" disabled={uploading}>
        {uploading ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
