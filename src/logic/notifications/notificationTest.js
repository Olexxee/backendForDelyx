import logger from "../../lib/logger.js";
import { io } from "socket.io-client";
import axios from "axios";

const SERVER_URL = "http://localhost:YOUR_PORT"; // replace with your server URL
const API_URL = `${SERVER_URL}/api/buddies/request`;

// Replace these with real JWTs for testing
const requesterToken = "REQUESTER_JWT";
const recipientToken = "RECIPIENT_JWT";

// Recipient socket
const recipientSocket = io(SERVER_URL, {
  auth: { token: recipientToken },
});

recipientSocket.on("connect", () => {
  logger.info("✅ Recipient connected via WebSocket:", recipientSocket.id);
});

recipientSocket.on("new_notification", (notification) => {
  logger.info("🔔 Recipient received notification:", notification);
});

// Requester socket (optional, if you want to listen for events too)
const requesterSocket = io(SERVER_URL, {
  auth: { token: requesterToken },
});

requesterSocket.on("connect", () => {
  logger.info("✅ Requester connected via WebSocket:", requesterSocket.id);
});

// Function to send a buddy request via API
const sendBuddyRequest = async () => {
  try {
    const response = await axios.post(
      API_URL,
      { recipientId: "RECIPIENT_USER_ID" }, // replace with recipient's user ID
      { headers: { Authorization: `Bearer ${requesterToken}` } }
    );
    logger.info("📩 Buddy request sent:", response.data);
  } catch (err) {
    logger.error("❌ Error sending buddy request:", err.response?.data || err.message);
  }
};

// Wait a few seconds to ensure sockets are connected, then send request
setTimeout(() => {
  sendBuddyRequest();
}, 2000);
