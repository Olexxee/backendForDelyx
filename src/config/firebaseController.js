import logger from "../lib/logger.js";
import * as firebaseService from "./firebaseService.js";
import { asyncWrapper } from "../lib/utils.js";

// Check if a Firebase user exists by email
export const checkUser = asyncWrapper(async (req, res) => {
  const { email } = req.body;
  const result = await firebaseService.checkIfFirebaseUserExists(email);
  res.status(200).json(result);
});

// Verify Firebase user password
export const verifyPassword = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  const result = await firebaseService.verifyFirebasePassword(email, password);
  res.status(200).json(result);
});

// Upload a file to Firebase
export const uploadFile = asyncWrapper(async (req, res) => {
  const { file } = req; 
  const uploadResult = await firebaseService.uploadFileToFirebase(file);
  res.status(201).json(uploadResult);
});

// Delete a file from Firebase
export const deleteFile = asyncWrapper(async (req, res) => {
  const { filePath } = req.body;
  const deleteResult = await firebaseService.deleteFileFromFirebase(filePath);
  res.status(200).json(deleteResult);
});
