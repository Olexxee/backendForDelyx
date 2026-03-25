import crypto from "crypto";

export const generateRoomKey = () => {
  return crypto.randomBytes(32); 
};
