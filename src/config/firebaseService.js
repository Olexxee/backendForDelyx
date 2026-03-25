import logger from "../lib/logger.js";
import { firebaseAuth, firebaseBucket } from "../config/firebaseAdmin.js";
import configService from "../lib/classes/configClass.js";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

/**
 * Check if a Firebase user exists by email
 * @param {string} email
 * @returns {Promise<{exists: boolean, uid?: string, provider?: string, emailVerified?: boolean, displayName?: string}>}
 */
export const checkIfFirebaseUserExists = async (email) => {
  try {
    const userRecord = await firebaseAuth.getUserByEmail(email);
    return {
      exists: true,
      uid: userRecord.uid,
      provider: userRecord.providerData?.[0]?.providerId || "firebase",
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
    };
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      return { exists: false };
    }
    logger.error("Firebase check user error", { email, error: err });
    throw err;
  }
};

/**
 * Verify Firebase password via REST API
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export const verifyFirebasePassword = async (email, password) => {
  try {
    const apiKey = configService.getOrThrow("FIREBASE_API_KEY");
    const { data } = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      { email, password, returnSecureToken: true }
    );
    return data;
  } catch (err) {
    logger.warn("Firebase password verification failed", {
      email,
      code: err.response?.data?.error?.message,
    });
    throw err;
  }
};

/**
 * Upload a file buffer to Firebase Storage
 * @param {Buffer} fileBuffer
 * @param {string} destinationPath
 * @param {string} contentType
 * @returns {Promise<{url: string, storagePath: string, token: string}>}
 */
export const uploadToFirebase = async (
  fileBuffer,
  destinationPath,
  contentType
) => {
  const file = firebaseBucket.file(destinationPath);
  const token = uuidv4();

  await file.save(fileBuffer, {
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
    resumable: false,
  });

  const bucketName = configService.getOrThrow("FIREBASE_STORAGE_BUCKET");
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    destinationPath
  )}?alt=media&token=${token}`;

  return { url, storagePath: destinationPath, token };
};

/**
 * Get a signed URL for a file in Firebase Storage
 * @param {string} filePath
 * @param {Date|string} expiresAt
 * @returns {Promise<string>}
 */
export const getSignedUrl = async (filePath, expiresAt) => {
  const [url] = await firebaseBucket.file(filePath).getSignedUrl({
    action: "read",
    expires: expiresAt,
  });
  return url;
};

/**
 * Delete a file from Firebase Storage
 * @param {string} filePath
 * @returns {Promise<{success: boolean}>}
 */
export const deleteFileFromFirebase = async (filePath) => {
  await firebaseBucket.file(filePath).delete();
  return { success: true };
};
