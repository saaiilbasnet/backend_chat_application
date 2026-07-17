import { createClient } from "redis";
import { env } from "../config/env.ts";
import logger from "./logger.ts";

const CACHE_PREFIX = "zeno";

const redisClient = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
      },
    })
  : null;

redisClient?.on("error", (error) => {
  logger.error("Redis cache error: " + error.message);
});

redisClient?.on("connect", () => {
  logger.info("Redis cache connected");
});

export const connectCache = async () => {
  if (!redisClient || redisClient.isOpen) return;

  try {
    await redisClient.connect();
  } catch (error) {
    logger.error("Error connecting Redis cache: " + (error as Error).message);
  }
};

export const disconnectCache = async () => {
  if (!redisClient?.isOpen) return;

  try {
    await redisClient.quit();
  } catch (error) {
    logger.error("Error disconnecting Redis cache: " + (error as Error).message);
  }
};

const key = (value: string) => `${CACHE_PREFIX}:${value}`;

export const cacheKeys = {
  friendState: (userId: string) => key(`friends:state:${userId}`),
  userSearch: (userId: string, query: string) =>
    key(`friends:search:${userId}:${query.toLowerCase()}`),
  sidebarUsers: (userId: string) => key(`messages:sidebar:${userId}`),
  directMessages: (userId: string, otherUserId: string) =>
    key(`messages:direct:${userId}:${otherUserId}`),
  myGroups: (userId: string) => key(`groups:mine:${userId}`),
  groupMessages: (groupId: string) => key(`groups:messages:${groupId}`),
};

export const getCache = async <T>(cacheKey: string): Promise<T | null> => {
  if (!redisClient?.isReady) return null;

  try {
    const cached = await redisClient.get(cacheKey);
    return cached ? JSON.parse(cached) as T : null;
  } catch (error) {
    logger.error("Error reading Redis cache: " + (error as Error).message);
    return null;
  }
};

export const setCache = async (
  cacheKey: string,
  value: unknown,
  ttlSeconds = env.CACHE_TTL_SECONDS,
) => {
  if (!redisClient?.isReady || ttlSeconds <= 0) return;

  try {
    await redisClient.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.error("Error writing Redis cache: " + (error as Error).message);
  }
};

export const deleteCache = async (...cacheKeysToDelete: string[]) => {
  if (!redisClient?.isReady || cacheKeysToDelete.length === 0) return;

  try {
    await redisClient.del(cacheKeysToDelete);
  } catch (error) {
    logger.error("Error deleting Redis cache keys: " + (error as Error).message);
  }
};

export const deleteCacheByPattern = async (pattern: string) => {
  if (!redisClient?.isReady) return;

  try {
    for await (const keys of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      const batch = Array.isArray(keys) ? keys : [keys];
      if (batch.length > 0) {
        await redisClient.del(batch);
      }
    }
  } catch (error) {
    logger.error("Error deleting Redis cache pattern: " + (error as Error).message);
  }
};

export const invalidateUserCaches = async (...userIds: string[]) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueUserIds.flatMap((userId) => [
      deleteCache(
        cacheKeys.friendState(userId),
        cacheKeys.sidebarUsers(userId),
        cacheKeys.myGroups(userId),
      ),
      deleteCacheByPattern(key(`friends:search:${userId}:*`)),
      deleteCacheByPattern(key(`messages:direct:${userId}:*`)),
    ]),
  );
};

export const invalidateDirectMessageCaches = async (userId: string, otherUserId: string) => {
  await Promise.all([
    deleteCache(
      cacheKeys.directMessages(userId, otherUserId),
      cacheKeys.directMessages(otherUserId, userId),
    ),
    deleteCache(cacheKeys.sidebarUsers(userId), cacheKeys.sidebarUsers(otherUserId)),
  ]);
};

export const invalidateGroupCaches = async (groupId: string, memberIds: string[] = []) => {
  await Promise.all([
    deleteCache(cacheKeys.groupMessages(groupId)),
    ...memberIds.map((memberId) => deleteCache(cacheKeys.myGroups(memberId))),
  ]);
};
