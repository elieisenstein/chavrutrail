// offlineMapService.ts
// Service for downloading and managing offline map tile packs

// Using legacy import for Expo SDK 54+ compatibility
// getInfoAsync, downloadAsync, etc. moved to expo-file-system/legacy
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RouteBbox } from "./routeMetrics";
import {
  getTilesForBbox,
  getTileUrl,
  getTileLocalPath,
  generatePackId,
  estimateDownloadSize,
  type TileCoord,
} from "./tileUtils";

// Storage limit: 500 MB
export const MAX_STORAGE_BYTES = 500 * 1024 * 1024;

// Download parameters (single source of truth)
export const OFFLINE_MIN_ZOOM = 10;
export const OFFLINE_MAX_ZOOM = 14;
export const OFFLINE_MARGIN_KM = 2;

// Keys for AsyncStorage
const PACKS_METADATA_KEY = "@bishvil_offline_map_packs";

// Base directory for tiles
const TILES_BASE_DIR = FileSystem.documentDirectory + "offline_tiles";

export type OfflineMapPack = {
  id: string;
  name: string; // User-friendly name (e.g., route file name)
  bbox: RouteBbox;
  language: "he" | "en";
  mapStyle: "hiking" | "mtb";
  tileCount: number;
  sizeBytes: number;
  downloadedAt: number;
  minZoom: number;
  maxZoom: number;
};

export type DownloadProgress = {
  downloaded: number;
  total: number;
  percent: number;
  currentTile?: TileCoord;
  failed: number;
};

export type DownloadResult = {
  success: boolean;
  pack?: OfflineMapPack;
  error?: string;
  failedTiles?: number;
};

/**
 * Get all saved offline map packs
 */
export async function getOfflinePacks(): Promise<OfflineMapPack[]> {
  try {
    const data = await AsyncStorage.getItem(PACKS_METADATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Failed to load offline packs metadata:", e);
  }
  return [];
}

/**
 * Save packs metadata to AsyncStorage
 */
async function savePacksMetadata(packs: OfflineMapPack[]): Promise<void> {
  await AsyncStorage.setItem(PACKS_METADATA_KEY, JSON.stringify(packs));
}

/**
 * Calculate total storage used by all packs
 */
export async function getTotalStorageUsed(): Promise<number> {
  const packs = await getOfflinePacks();
  return packs.reduce((sum, pack) => sum + pack.sizeBytes, 0);
}

/**
 * Check if there's enough storage for a new download
 */
export async function hasStorageSpace(
  requiredBytes: number
): Promise<{ hasSpace: boolean; usedBytes: number; availableBytes: number }> {
  const usedBytes = await getTotalStorageUsed();
  const availableBytes = MAX_STORAGE_BYTES - usedBytes;
  return {
    hasSpace: requiredBytes <= availableBytes,
    usedBytes,
    availableBytes,
  };
}

/**
 * Ensure directory exists
 */
async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

/**
 * Download a single tile
 * Returns actual size in bytes, or -1 if failed
 */
async function downloadTile(
  tile: TileCoord,
  url: string,
  localPath: string
): Promise<number> {
  try {
    // Ensure parent directory exists
    const parentDir = localPath.substring(0, localPath.lastIndexOf("/"));
    await ensureDir(parentDir);

    // Download the tile
    const result = await FileSystem.downloadAsync(url, localPath);

    if (result.status === 200) {
      const info = await FileSystem.getInfoAsync(localPath);
      return info.exists && info.size ? info.size : 0;
    } else {
      // Non-200 status - delete any partial file
      await FileSystem.deleteAsync(localPath, { idempotent: true });
      return -1;
    }
  } catch (e) {
    console.warn(`Failed to download tile z${tile.z}/${tile.x}/${tile.y}:`, e);
    return -1;
  }
}

/**
 * Download offline map pack for a route
 * @param name User-friendly name for the pack
 * @param bbox Route bounding box
 * @param language Map language (he/en)
 * @param mapStyle Map style (hiking/mtb)
 * @param onProgress Progress callback
 * @param abortSignal Optional abort signal to cancel download
 */
export async function downloadOfflinePack(
  name: string,
  bbox: RouteBbox,
  language: "he" | "en",
  mapStyle: "hiking" | "mtb",
  onProgress?: (progress: DownloadProgress) => void,
  abortSignal?: { aborted: boolean }
): Promise<DownloadResult> {
  // Get tiles to download
  const tiles = getTilesForBbox(bbox, OFFLINE_MARGIN_KM, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM);
  const totalTiles = tiles.length;

  // Estimate size
  const estimated = estimateDownloadSize(totalTiles);

  // Check storage space
  const storage = await hasStorageSpace(estimated.bytes);
  if (!storage.hasSpace) {
    return {
      success: false,
      error: `Not enough storage. Need ${estimated.formatted}, have ${formatBytes(storage.availableBytes)} available.`,
    };
  }

  // Generate pack ID and create directory
  const packId = generatePackId(bbox);
  const packDir = `${TILES_BASE_DIR}/${packId}`;

  try {
    await ensureDir(packDir);
  } catch (e) {
    return {
      success: false,
      error: `Failed to create pack directory: ${e}`,
    };
  }

  // Download tiles with progress
  let downloaded = 0;
  let failed = 0;
  let totalSizeBytes = 0;

  for (const tile of tiles) {
    // Check for abort
    if (abortSignal?.aborted) {
      // Clean up partial download
      await deletePackFiles(packId);
      return {
        success: false,
        error: "Download cancelled",
      };
    }

    const url = getTileUrl(tile, language, mapStyle);
    const localPath = getTileLocalPath(packId, tile, FileSystem.documentDirectory!);

    const tileSize = await downloadTile(tile, url, localPath);

    if (tileSize >= 0) {
      totalSizeBytes += tileSize;
      downloaded++;
    } else {
      failed++;
    }

    // Report progress
    onProgress?.({
      downloaded,
      total: totalTiles,
      percent: Math.round((downloaded / totalTiles) * 100),
      currentTile: tile,
      failed,
    });
  }

  // If too many failures, consider it failed
  if (failed > totalTiles * 0.1) {
    // More than 10% failed
    await deletePackFiles(packId);
    return {
      success: false,
      error: `Too many tiles failed to download (${failed}/${totalTiles})`,
      failedTiles: failed,
    };
  }

  // Save pack metadata
  const pack: OfflineMapPack = {
    id: packId,
    name,
    bbox,
    language,
    mapStyle,
    tileCount: downloaded,
    sizeBytes: totalSizeBytes,
    downloadedAt: Date.now(),
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
  };

  const existingPacks = await getOfflinePacks();
  existingPacks.push(pack);
  await savePacksMetadata(existingPacks);

  return {
    success: true,
    pack,
    failedTiles: failed > 0 ? failed : undefined,
  };
}

/**
 * Delete pack files from disk
 */
async function deletePackFiles(packId: string): Promise<void> {
  const packDir = `${TILES_BASE_DIR}/${packId}`;
  try {
    await FileSystem.deleteAsync(packDir, { idempotent: true });
  } catch (e) {
    console.warn("Failed to delete pack files:", e);
  }
}

/**
 * Delete an offline map pack
 */
export async function deleteOfflinePack(packId: string): Promise<boolean> {
  try {
    // Delete files
    await deletePackFiles(packId);

    // Remove from metadata
    const packs = await getOfflinePacks();
    const filtered = packs.filter((p) => p.id !== packId);
    await savePacksMetadata(filtered);

    return true;
  } catch (e) {
    console.error("Failed to delete offline pack:", e);
    return false;
  }
}

/**
 * Delete all offline packs
 */
export async function deleteAllPacks(): Promise<boolean> {
  try {
    // Delete entire tiles directory
    await FileSystem.deleteAsync(TILES_BASE_DIR, { idempotent: true });

    // Clear metadata
    await savePacksMetadata([]);

    return true;
  } catch (e) {
    console.error("Failed to delete all packs:", e);
    return false;
  }
}

/**
 * Check if a tile exists in any offline pack
 * Returns local file path if found, null otherwise
 */
export async function getOfflineTilePath(
  tile: TileCoord,
  language: "he" | "en",
  mapStyle: "hiking" | "mtb"
): Promise<string | null> {
  const packs = await getOfflinePacks();

  // Find packs that match language and style
  const matchingPacks = packs.filter(
    (p) => p.language === language && p.mapStyle === mapStyle
  );

  for (const pack of matchingPacks) {
    // Check if tile is within this pack's zoom range
    if (tile.z < pack.minZoom || tile.z > pack.maxZoom) {
      continue;
    }

    // Check if tile is within this pack's bbox
    // Convert tile to lat/lng and check against bbox
    const localPath = getTileLocalPath(pack.id, tile, FileSystem.documentDirectory!);

    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      return localPath;
    }
  }

  return null;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Format date to locale string
 */
export function formatPackDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}
