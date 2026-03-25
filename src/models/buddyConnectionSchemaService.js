import logger from "../lib/logger.js";
import BuddyConnection from "./buddyConnectionSchema.js";

// Create a new buddy connection
export async function createConnection(data) {
  const connection = await BuddyConnection.create(data);
  return connection;
}

// Find a single connection by filter
export async function findConnection(filter) {
  const connection = await BuddyConnection.findOne(filter);
  return connection;
}

// Find a single connection by ID
export async function findConnectionById(id) {
  const connection = await BuddyConnection.findById(id);
  return connection;
}

// Find multiple connections with optional sort/limit/pagination
export async function findConnections(filter, options = {}) {
  const connections = await BuddyConnection.find(filter)
    .populate("requester recipient", "username profilePicture")
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);

  return connections;
}

// Update a single connection
export async function updateConnection(filter, updateData) {
  const updatedConnection = await BuddyConnection.findOneAndUpdate(
    filter,
    updateData,
    { new: true }
  );
  return updatedConnection;
}

// Delete a single connection
export async function deleteConnection(filter) {
  const deletedConnection = await BuddyConnection.findOneAndDelete(filter);
  return deletedConnection;
}

// Count connections sent by a user today
export const countConnectionsToday = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return BuddyConnection.countDocuments({
    requester: userId, // adjust field name if it's `fromUser` or similar
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });
};