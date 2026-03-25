import configService from "./src/lib/classes/configClass.js";
import dotenv from "dotenv";
import { server } from "./src/server/serverConfig.js";
import connectDB from "./src/lib/database.js";
import path from "path";

dotenv.config();

console.log("ENV:", configService.get("NODE_ENV"));
console.log("PORT:", configService.getOrThrow("PORT"));
console.log("JWT:", configService.getOrThrow("JWT_SECRET").slice(0, 6) + "...");
console.log("COOKIE:", configService.getOrThrow("COOKIE_SECRET").slice(0, 6) + "...");
console.log("MONGO_URI OK:", !!configService.getOrThrow("MONGO_URI"));
console.log("jwt expire in:", configService.getOrThrow("JWT_EXPIRE_IN"));

(() => {
  try {
    const port = parseInt(configService.getOrThrow("PORT"));
    connectDB();
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
