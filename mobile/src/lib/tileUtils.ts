// tileUtils.ts
// Utilities for converting lat/lng to map tile coordinates

import type { RouteBbox } from "./routeMetrics";

/**
 * Convert latitude/longitude to tile coordinates at a given zoom level
 * Uses the standard Web Mercator (EPSG:3857) tile scheme
 * @see https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
export function latLngToTile(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * Convert tile coordinates back to lat/lng (NW corner of tile)
 */
export function tileToLatLng(
  x: number,
  y: number,
  zoom: number
): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export type TileCoord = {
  z: number;
  x: number;
  y: number;
};

/**
 * Calculate all tiles needed to cover a bounding box at given zoom levels
 * @param bbox Route bounding box
 * @param marginKm Margin to add around bbox in km (default 2km)
 * @param minZoom Minimum zoom level (default 10)
 * @param maxZoom Maximum zoom level (default 15)
 * @returns Array of tile coordinates
 */
export function getTilesForBbox(
  bbox: RouteBbox,
  marginKm: number = 2,
  minZoom: number = 10,
  maxZoom: number = 15
): TileCoord[] {
  // Convert margin from km to degrees (rough approximation for Israel latitudes)
  // 1 degree latitude ≈ 111 km, 1 degree longitude ≈ 85 km at 32°N
  const marginLat = marginKm / 111;
  const marginLng = marginKm / 85;

  // Expand bbox with margin
  const expandedBbox: RouteBbox = {
    minLat: bbox.minLat - marginLat,
    maxLat: bbox.maxLat + marginLat,
    minLng: bbox.minLng - marginLng,
    maxLng: bbox.maxLng + marginLng,
  };

  const tiles: TileCoord[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    // Get tile coords for corners
    const nw = latLngToTile(expandedBbox.maxLat, expandedBbox.minLng, z);
    const se = latLngToTile(expandedBbox.minLat, expandedBbox.maxLng, z);

    // Iterate through all tiles in the range
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  return tiles;
}

/**
 * Count tiles needed for each zoom level
 * Useful for showing breakdown to user
 */
export function countTilesByZoom(
  bbox: RouteBbox,
  marginKm: number = 2,
  minZoom: number = 10,
  maxZoom: number = 15
): Map<number, number> {
  const counts = new Map<number, number>();

  const marginLat = marginKm / 111;
  const marginLng = marginKm / 85;

  const expandedBbox: RouteBbox = {
    minLat: bbox.minLat - marginLat,
    maxLat: bbox.maxLat + marginLat,
    minLng: bbox.minLng - marginLng,
    maxLng: bbox.maxLng + marginLng,
  };

  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = latLngToTile(expandedBbox.maxLat, expandedBbox.minLng, z);
    const se = latLngToTile(expandedBbox.minLat, expandedBbox.maxLng, z);

    const tilesX = se.x - nw.x + 1;
    const tilesY = se.y - nw.y + 1;
    counts.set(z, tilesX * tilesY);
  }

  return counts;
}

/**
 * Estimate download size for tiles
 * Based on average tile size of ~12KB for raster tiles
 */
export function estimateDownloadSize(tileCount: number): {
  bytes: number;
  formatted: string;
} {
  const avgTileSizeBytes = 12 * 1024; // ~12 KB per tile
  const totalBytes = tileCount * avgTileSizeBytes;

  let formatted: string;
  if (totalBytes >= 1024 * 1024 * 1024) {
    formatted = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (totalBytes >= 1024 * 1024) {
    formatted = `${(totalBytes / (1024 * 1024)).toFixed(0)} MB`;
  } else if (totalBytes >= 1024) {
    formatted = `${(totalBytes / 1024).toFixed(0)} KB`;
  } else {
    formatted = `${totalBytes} B`;
  }

  return { bytes: totalBytes, formatted };
}

/**
 * Generate tile URL for Israel Hiking Map tiles
 */
export function getTileUrl(
  tile: TileCoord,
  language: "he" | "en",
  mapStyle: "hiking" | "mtb"
): string {
  if (mapStyle === "mtb") {
    return `https://israelhiking.osm.org.il/mtbTiles/${tile.z}/${tile.x}/${tile.y}.png`;
  }

  const langPath = language === "he" ? "Hebrew" : "English";
  return `https://israelhiking.osm.org.il/${langPath}/Tiles/${tile.z}/${tile.x}/${tile.y}.png`;
}

/**
 * Get the local file path for a cached tile
 */
export function getTileLocalPath(
  packId: string,
  tile: TileCoord,
  baseDir: string
): string {
  return `${baseDir}/offline_tiles/${packId}/${tile.z}/${tile.x}/${tile.y}.png`;
}

/**
 * Generate a unique pack ID based on bbox and timestamp
 */
export function generatePackId(bbox: RouteBbox): string {
  const timestamp = Date.now();
  const bboxHash = `${bbox.minLat.toFixed(3)}_${bbox.minLng.toFixed(3)}_${bbox.maxLat.toFixed(3)}_${bbox.maxLng.toFixed(3)}`;
  return `pack_${bboxHash}_${timestamp}`;
}
