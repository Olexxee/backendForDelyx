import cacheManager from "../cacheManager.js";

const buildSharedKey = (groupId) => `groupHub:shared:${groupId}`;

export const getGroupHubShared = async (groupId) => {
  return cacheManager.get(buildSharedKey(groupId));
};

export const setGroupHubShared = async (groupId, value, ttlSeconds = 60) => {
  return cacheManager.set(buildSharedKey(groupId), value, ttlSeconds);
};

export const deleteGroupHubShared = async (groupId) => {
  return cacheManager.delete(buildSharedKey(groupId));
};
