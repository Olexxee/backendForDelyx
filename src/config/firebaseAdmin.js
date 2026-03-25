import admin from "firebase-admin";
import configService from "../lib/classes/configClass.js";
import logger from "../lib/logger.js";

const serviceAccountBase64 = configService.getOrThrow(
  "FIREBASE_SERVICE_ACCOUNT_BASE64"
);

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, "base64").toString("utf8")
);

const firebaseApp =
  admin.apps.length === 0
    ? admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // storageBucket: configService.getOrThrow("FIREBASE_STORAGE_BUCKET"),
      })
    : admin.app();

logger.info("Firebase Admin initialized (Base64)");

export const firebaseAuth = firebaseApp.auth();
// export const firebaseStorage = firebaseApp.storage();
// export const firebaseBucket = firebaseApp.storage().bucket();
export const firebaseMessaging = firebaseApp.messaging();
