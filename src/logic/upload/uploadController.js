import logger from "../lib/logger.js";
import { asyncWrapper } from "../../lib/utils.js";
import { processUploadedMedia } from "../middleware/processUploadedMedia.js";
import mediaServerService from "../logic/upload/uploadService.js";

export const uploadMedia = asyncWrapper(async (req, res) => {
  const type = req.query.type || "post";

  const uploadedMedia = await processUploadedMedia(req.files, type, {
    resizeWidth: 800,
    resizeHeight: 800,
    minCount: 1,
  });

  const savedMedia = await Promise.all(
    uploadedMedia.map((media) =>
      mediaServerService.uploadMedia({
        ownerId: req.user.id,
        type,
        ...media,
      })
    )
  );

  res.status(201).json({
    success: true,
    count: savedMedia.length,
    media: savedMedia,
  });
});

export const getMediaById = asyncWrapper(async (req, res) => {
  const media = await mediaServerService.getMediaById(req.user, req.params.id);
  res.status(200).json({ media });
});

export const getUserMedia = asyncWrapper(async (req, res) => {
  const media = await mediaServerService.getUserMedia(req.user, req.query.type);
  res.status(200).json({ media });
});

export const deleteMedia = asyncWrapper(async (req, res) => {
  await mediaServerService.deleteMedia(req.user, [req.params.id]);
  res.status(200).json({ message: "Media deleted successfully" });
});
