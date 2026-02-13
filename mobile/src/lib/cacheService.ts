import AsyncStorage from "@react-native-async-storage/async-storage";

// Cache entry structure with metadata
export type CacheEntry<T> = {
  data: T;
  timestamp: number; // Unix timestamp in milliseconds
  version: number; // Schema version for migrations
};

// Current cache schema version - increment when data structure changes
const CACHE_VERSION = 1;

// Cache key prefix
const CACHE_PREFIX = "@bishvil_cache_";

// Cache keys
export const CACHE_KEYS = {
  feed: `${CACHE_PREFIX}feed`,
  myRidesActive: `${CACHE_PREFIX}my_rides_active`,
  myRidesHistory: `${CACHE_PREFIX}my_rides_history`,
  profile: `${CACHE_PREFIX}profile`,
} as const;

/**
 * Store data in cache with timestamp
 */
export async function setCache<T>(
  key: string,
  data: T
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

/**
 * Get cached data with metadata
 * Returns null if not found or version mismatch
 */
export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;

    // Check version - invalidate if schema changed
    if (entry.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry;
  } catch (error) {
    console.warn(`Cache read error for ${key}:`, error);
    return null;
  }
}

/**
 * Get just the cached data without metadata
 */
export async function getCacheData<T>(key: string): Promise<T | null> {
  const entry = await getCache<T>(key);
  return entry?.data ?? null;
}

/**
 * Get cache age in minutes
 * Returns null if not cached
 */
export async function getCacheAge(key: string): Promise<number | null> {
  const entry = await getCache<unknown>(key);
  if (!entry) return null;

  const ageMs = Date.now() - entry.timestamp;
  return Math.floor(ageMs / 60000); // Convert to minutes
}

/**
 * Check if cache is stale (older than maxAgeMinutes)
 * Returns true if stale or not cached
 */
export async function isCacheStale(
  key: string,
  maxAgeMinutes: number
): Promise<boolean> {
  const age = await getCacheAge(key);
  if (age === null) return true;
  return age > maxAgeMinutes;
}

/**
 * Clear specific cache key or all cache keys
 */
export async function clearCache(key?: string): Promise<void> {
  if (key) {
    await AsyncStorage.removeItem(key);
  } else {
    // Clear all cache keys
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  }
}

/**
 * Get formatted cache age string for display
 */
export function formatCacheAge(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Get staleness level for UI styling
 */
export function getStalenessLevel(minutes: number): "fresh" | "stale" | "very-stale" | "expired" {
  if (minutes < 5) return "fresh";
  if (minutes < 30) return "stale";
  if (minutes < 60) return "very-stale";
  return "expired";
}
