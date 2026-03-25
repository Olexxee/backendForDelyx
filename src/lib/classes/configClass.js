import { config } from "dotenv";

config();

class ConfigService {
  // Get environment variable or undefined
  get(key) {
    const value = process.env[key];
    // Handle special case for ALLOWED_ORIGINS as array
    if (key === "ALLOWED_ORIGINS" && value) {
      return value.split(",").map((origin) => origin.trim());
    }
    return value;
  }

  // Get environment variable or throw error if not set
  getOrThrow(key) {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
  }

  // Get base URL for server
  getBaseUrl() {
    const protocol = this.get("BASE_PROTOCOL") || "http";
    const host = this.get("BASE_HOST") || "localhost";
    const port = this.get("PORT") || "5000";
    return `${protocol}://${host}:${port}`;
  }
}

const configService = new ConfigService();
export default configService;
