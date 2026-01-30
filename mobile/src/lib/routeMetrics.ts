// routeMetrics.ts
// Utilities for computing route progress and remaining metrics

/**
 * Haversine distance between two points in meters
 */
export function haversineDistance(
  lon1: number, lat1: number,
  lon2: number, lat2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type RouteBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type RouteMetrics = {
  totalDistanceM: number;
  totalAscentM: number;
  cumDistances: number[];      // cumulative distance at each point (0 at start)
  cumAscents: number[];        // cumulative ascent at each point (0 at start)
  bbox: RouteBbox;             // bounding box of the route
  startPoint: [number, number]; // [lng, lat] of first point
};

/**
 * Precompute cumulative distances and ascents for a route
 * @param route Array of [lng, lat] coordinates
 * @param elevations Optional array of elevations (meters) at each point
 */
export function computeRouteMetrics(
  route: [number, number][],
  elevations?: number[] | null
): RouteMetrics {
  const cumDistances: number[] = [0];
  const cumAscents: number[] = [0];

  let totalDistance = 0;
  let totalAscent = 0;

  // Compute bounding box
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (let i = 0; i < route.length; i++) {
    const [lng, lat] = route[i];

    // Update bbox
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);

    if (i > 0) {
      const [lng1, lat1] = route[i - 1];

      // Distance
      const segmentDist = haversineDistance(lng1, lat1, lng, lat);
      totalDistance += segmentDist;
      cumDistances.push(totalDistance);

      // Ascent (only if elevations provided)
      if (elevations && elevations.length > i) {
        const elevChange = elevations[i] - elevations[i - 1];
        if (elevChange > 0) {
          totalAscent += elevChange;
        }
      }
      cumAscents.push(totalAscent);
    }
  }

  return {
    totalDistanceM: totalDistance,
    totalAscentM: totalAscent,
    cumDistances,
    cumAscents,
    bbox: { minLng, minLat, maxLng, maxLat },
    startPoint: route[0],
  };
}

/**
 * Find the nearest point on the route and estimate progress
 * @param position Current position [lng, lat]
 * @param route Route coordinates
 * @param cumDistances Precomputed cumulative distances
 * @returns Object with nearest index and estimated progress in meters
 */
export function findRouteProgress(
  position: [number, number],
  route: [number, number][],
  cumDistances: number[]
): { nearestIndex: number; progressM: number } {
  const [posLng, posLat] = position;

  let nearestIndex = 0;
  let nearestDist = Infinity;

  // Find nearest point on route
  for (let i = 0; i < route.length; i++) {
    const [lng, lat] = route[i];
    const dist = haversineDistance(posLng, posLat, lng, lat);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = i;
    }
  }

  // Estimate progress with interpolation between segments
  let progressM = cumDistances[nearestIndex];

  // Check if we're between nearestIndex and an adjacent point
  if (nearestIndex > 0 && nearestIndex < route.length - 1) {
    const prevDist = haversineDistance(posLng, posLat, route[nearestIndex - 1][0], route[nearestIndex - 1][1]);
    const nextDist = haversineDistance(posLng, posLat, route[nearestIndex + 1][0], route[nearestIndex + 1][1]);

    // If closer to previous segment, interpolate backwards
    if (prevDist < nextDist && prevDist < nearestDist * 2) {
      const segmentLen = cumDistances[nearestIndex] - cumDistances[nearestIndex - 1];
      const ratio = nearestDist / (nearestDist + prevDist);
      progressM = cumDistances[nearestIndex - 1] + segmentLen * ratio;
    }
    // If closer to next segment, interpolate forwards
    else if (nextDist < nearestDist * 2) {
      const segmentLen = cumDistances[nearestIndex + 1] - cumDistances[nearestIndex];
      const ratio = nearestDist / (nearestDist + nextDist);
      progressM = cumDistances[nearestIndex] + segmentLen * ratio;
    }
  }

  return { nearestIndex, progressM };
}

export type RemainingMetrics = {
  remainingKm: number;
  remainingAscentM: number;
  etaMinutes: number | null;  // null if speed is 0 or too low
};

/**
 * Compute remaining distance, ascent, and ETA
 * @param metrics Precomputed route metrics
 * @param progressM Current progress along route in meters
 * @param speedMs Current speed in m/s (filtered)
 * @returns Remaining metrics
 */
export function computeRemainingMetrics(
  metrics: RouteMetrics,
  progressM: number,
  speedMs: number
): RemainingMetrics {
  const remainingM = Math.max(0, metrics.totalDistanceM - progressM);
  const remainingKm = remainingM / 1000;

  // Find current ascent at progress point (interpolate between cum values)
  let currentAscent = 0;
  for (let i = 1; i < metrics.cumDistances.length; i++) {
    if (metrics.cumDistances[i] >= progressM) {
      // Interpolate
      const prevDist = metrics.cumDistances[i - 1];
      const ratio = (progressM - prevDist) / (metrics.cumDistances[i] - prevDist);
      const prevAscent = metrics.cumAscents[i - 1];
      const currAscent = metrics.cumAscents[i];
      currentAscent = prevAscent + (currAscent - prevAscent) * ratio;
      break;
    }
  }
  // If past all points, use total
  if (progressM >= metrics.totalDistanceM) {
    currentAscent = metrics.totalAscentM;
  }

  const remainingAscentM = Math.max(0, metrics.totalAscentM - currentAscent);

  // ETA calculation
  let etaMinutes: number | null = null;
  if (speedMs >= 0.5) {  // Only calculate if moving at least 1.8 km/h
    const etaSeconds = remainingM / speedMs;
    etaMinutes = Math.round(etaSeconds / 60);
  }

  return {
    remainingKm,
    remainingAscentM,
    etaMinutes,
  };
}

/**
 * Format remaining metrics as a display string
 * Always shows all three metrics for consistency: distance, ascent, ETA
 * @param metrics Remaining metrics
 * @returns Formatted string like "6.2 km • +420 m • ~45 min"
 */
export function formatRemainingMetrics(metrics: RemainingMetrics): string {
  const parts: string[] = [];

  // Distance (always shown)
  if (metrics.remainingKm >= 10) {
    parts.push(`${metrics.remainingKm.toFixed(0)} km`);
  } else {
    parts.push(`${metrics.remainingKm.toFixed(1)} km`);
  }

  // Ascent (always shown, even if 0)
  parts.push(`+${Math.round(metrics.remainingAscentM)} m`);

  // ETA (always shown - use "--" when not moving)
  if (metrics.etaMinutes !== null) {
    if (metrics.etaMinutes >= 60) {
      const hours = Math.floor(metrics.etaMinutes / 60);
      const mins = metrics.etaMinutes % 60;
      parts.push(`~${hours}h ${mins}m`);
    } else {
      parts.push(`~${metrics.etaMinutes} min`);
    }
  } else {
    parts.push('-- min');
  }

  return parts.join(' • ');
}

/**
 * Check if a position is near the route area (within bbox + margin)
 * @param position Current position [lng, lat]
 * @param bbox Route bounding box
 * @returns true if position is within expanded bbox
 */
export function isNearRouteArea(
  position: [number, number],
  bbox: RouteBbox
): boolean {
  // Expand bbox by ~2km margin (rough: 0.018° ≈ 2km at Israel latitudes)
  const marginDeg = 0.018;
  const [lng, lat] = position;
  return (
    lng >= bbox.minLng - marginDeg &&
    lng <= bbox.maxLng + marginDeg &&
    lat >= bbox.minLat - marginDeg &&
    lat <= bbox.maxLat + marginDeg
  );
}

/**
 * Compute distance from current position to route start point
 * @param position Current position [lng, lat]
 * @param startPoint Route start point [lng, lat]
 * @returns Distance in meters
 */
export function computeDistanceToStart(
  position: [number, number],
  startPoint: [number, number]
): number {
  return haversineDistance(position[0], position[1], startPoint[0], startPoint[1]);
}

/**
 * Format distance to start as display string
 * @param distanceM Distance in meters
 * @returns Formatted string like "Route loaded • 5.2 km to start"
 */
export function formatDistanceToStart(distanceM: number): string {
  const km = distanceM / 1000;
  if (km >= 10) {
    return `Route loaded • ${km.toFixed(0)} km to start`;
  }
  return `Route loaded • ${km.toFixed(1)} km to start`;
}
