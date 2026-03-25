import { createHmac } from "crypto";

export function convertHumanReadableTimeToMilliseconds(timestring) {
  //  time format can be like this: "90d" | "1h" | "3w"
  const match = timestring.match(/^(\d+)(\w+)$/);
  if (!match) {
    throw new Error(
      'Invalid time format. Expected format: "90d" | "1h" | "3w"',
    );
  }

  const number = parseInt(match[1], 10);
  const unit = match[2];

  let milliseconds;
  switch (unit) {
    case "ms":
      milliseconds = number;
      break;
    case "s":
      milliseconds = number * 1000;
      break;
    case "m":
      milliseconds = number * 60 * 1000;
      break;
    case "h":
      milliseconds = number * 60 * 60 * 1000;
      break;
    case "d":
      milliseconds = number * 24 * 60 * 60 * 1000;
      break;
    case "w":
      milliseconds = number * 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(
        "Invalid time unit. Expected units: ms | s | m | h | d | w",
      );
  }

  return milliseconds;
}

export function asyncWrapper(callback) {
  return async function (req, res, next) {
    try {
      await callback(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function socketAsyncWrapper(callback) {
  return async function (socket, next) {
    try {
      await callback(socket, next);
    } catch (error) {
      next(error);
    }
  };
}

export const hmacProcess = (value, key) => {
  const result = createHmac("sha256", key).update(value).digest("hex");
  return result;
};
