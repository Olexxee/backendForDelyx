import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

// Ensure logs folder exists
const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(logColors);

// Reusable rotate config
const createRotateTransport = (level) =>
  new DailyRotateFile({
    level,
    dirname: logDir,
    filename: `${level}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,     // compress old logs
    maxSize: "20m",          // max file size before rotation
    maxFiles: "7d",          // keep only 7 days
  });

const logger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    // Console (with colors)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message }) =>
            `[${timestamp}] ${level.toUpperCase()}: ${message}`
        )
      ),
    }),

    // Per-level rotating logs
    createRotateTransport("error"),
    createRotateTransport("warn"),
    createRotateTransport("info"),
    createRotateTransport("http"),
    createRotateTransport("debug"),

    // Combined rotating log
    new DailyRotateFile({
      filename: path.join(logDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "7d",
    }),
  ],
});

export default logger;
