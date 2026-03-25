import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_ENCODING = "hex";
const IV_LENGTH = 12; // Recommended for GCM

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} plaintext
 * @param {string} keyHex - 32-byte key in hex format
 * @returns {{ cipherText: string, iv: string, authTag: string }}
 */
export const encrypt = (plaintext, keyHex) => {
  if (!plaintext) throw new Error("Plaintext is required");
  if (!keyHex) throw new Error("Encryption key is required");

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(keyHex, KEY_ENCODING);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    cipherText: encryptedBuffer.toString(KEY_ENCODING),
    iv: iv.toString(KEY_ENCODING),
    authTag: cipher.getAuthTag().toString(KEY_ENCODING),
  };
};

/**
 * Decrypt AES-256-GCM encrypted payload
 * @param {string} cipherText
 * @param {string} keyHex
 * @param {string} ivHex
 * @param {string} authTagHex
 * @returns {string}
 */
export const decrypt = (cipherText, keyHex, ivHex, authTagHex) => {
  if (!cipherText || !ivHex || !authTagHex) {
    throw new Error("Invalid encrypted payload");
  }

  const key = Buffer.from(keyHex, KEY_ENCODING);
  const iv = Buffer.from(ivHex, KEY_ENCODING);
  const authTag = Buffer.from(authTagHex, KEY_ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(Buffer.from(cipherText, KEY_ENCODING)),
    decipher.final(),
  ]);

  return decryptedBuffer.toString("utf8");
};

/**
 * Generate a secure random AES-256 key (hex encoded)
 * @returns {string}
 */
export const generateKey = () => {
  return crypto.randomBytes(32).toString(KEY_ENCODING);
};
