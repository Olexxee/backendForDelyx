import mongoose from "mongoose";
import configService from "./classes/configClass.js";

export default async function connectDB() {
  try {
    await mongoose.connect(configService.getOrThrow("MONGO_URI"));
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
