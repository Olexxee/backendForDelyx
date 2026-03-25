import { v2 as cloudinary } from "cloudinary";
import configService from "../lib/classes/configClass.js";
import logger from "../lib/logger.js";

cloudinary.config({
  cloud_name: configService.getOrThrow("CLOUDINARY_CLOUD_NAME"),
  api_key: configService.getOrThrow("CLOUDINARY_API_KEY"),
  api_secret: configService.getOrThrow("CLOUDINARY_API_SECRET"),
});

console.log(cloudinary.config().cloud_name);

logger.info("☁️ Cloudinary initialized");

export default cloudinary;
