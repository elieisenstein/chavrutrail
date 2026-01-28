// src/lib/gpx.ts — GPX file validation and coordinate extraction

export const MAX_GPX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/** Check that the file content looks like a GPX file with track points */
export function isValidGpx(content: string): boolean {
  return content.includes("<gpx") && content.includes("<trkpt");
}

/**
 * Extract [lng, lat] coordinates from GPX XML string using regex.
 * GPX trkpt format: <trkpt lat="31.5" lon="34.75">
 * Returns array in [longitude, latitude] order (GeoJSON convention).
 */
export function parseGpxCoordinates(
  gpxContent: string
): [number, number][] {
  const coords: [number, number][] = [];
  const regex = /<trkpt\s+lat=["']([^"']+)["']\s+lon=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      coords.push([lon, lat]); // GeoJSON order: [lng, lat]
    }
  }
  return coords;
}
