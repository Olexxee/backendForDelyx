import logger from "../lib/logger.js";
import Media from "./mediaSchema.js";

const mediaService = {
  createMedia: async (data) => {
    return await Media.create(data);
  },

  getMediaById: async (id) => {
    return await Media.findById(id);
  },

  getUserMedia: async (userId, type) => {
    const filter = { owner: userId };
    if (type) filter.type = type;
    return await Media.find(filter);
  },

  markExpired: async (mediaId) => {
    return await Media.findByIdAndUpdate(mediaId, { isExpired: true });
  },

  deleteMediaById: async (id) => {
    return await Media.findByIdAndDelete(id);
  },

  findMarkedBefore: async (now = new Date()) => {
    return await Media.find({
      isExpired: true,
      expiresAt: { $lte: now },
    });
  },

  getExpiredMedia: async () => {
    return await Media.find({
      expiresAt: { $lte: new Date() },
      isExpired: false,
    });
  },

  findExpiredChatMedia: async (now) => {
    return await Media.find({
      expiresAt: { $lte: now },
      context: "chat",
    });
  },
};

export default mediaService;
