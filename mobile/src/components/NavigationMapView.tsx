// NavigationMapView.tsx
// Specialized map component for navigation with North-Up and Heading-Up modes

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, Animated, Easing } from 'react-native';
import { Text, Icon, useTheme, ActivityIndicator } from 'react-native-paper';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as Battery from 'expo-battery';
import { getIsraelHikingTiles } from '../lib/mapbox';
import { NavigationMode, NavigationPosition, DebugInfo, useNavigation } from '../app/state/NavigationContext';
import {
  computeRouteMetrics,
  findRouteProgress,
  computeRemainingMetrics,
  formatRemainingMetrics,
  isNearRouteArea,
  computeDistanceToStart,
  formatDistanceToStart,
  RouteMetrics,
  RouteBbox,
} from '../lib/routeMetrics';
import { isValidGpx, parseGpxCoordinates, MAX_GPX_FILE_SIZE } from '../lib/gpx';
import { OfflineMapDownload } from './OfflineMapDownload';
import { isOnline } from '../lib/network';

type NavigationMapViewProps = {
  currentPosition: NavigationPosition | null;
  route: [number, number][] | null;
  routeElevations?: number[] | null;  // Elevation at each route point for ascent calculations
  mode: NavigationMode;
  onToggleMode: () => void;
  onLoadRoute?: (coords: [number, number][], name?: string) => void;
  onClearRoute?: () => void;
  debugInfo?: DebugInfo;  // For dev debug row
  onWakeBrightness?: () => void;  // Tap to wake from dimmed state
};

export default function NavigationMapView({
  currentPosition,
  route,
  routeElevations,
  mode,
  onToggleMode,
  onLoadRoute,
  onClearRoute,
  debugInfo,
  onWakeBrightness,
}: NavigationMapViewProps) {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const { config } = useNavigation();
  const [isLoadingGpx, setIsLoadingGpx] = useState(false);

  const [showSpeed, setShowSpeed] = useState(false);

  // Offline map download prompt state
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [routeName, setRouteName] = useState<string>('Route');
  const [pendingDownloadBbox, setPendingDownloadBbox] = useState<RouteBbox | null>(null);

const { baseTiles, trailTiles } = getIsraelHikingTiles(
  i18n.language === 'he' ? 'he' : 'en',
  config.mapStyle
);

// Top info bar state
const [currentTime, setCurrentTime] = useState<string>('');
const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

// IMPORTANT: Start as null, so we don't render a "default Israel view" first (like MapPickerModal)
const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
const [mapZoom, setMapZoom] = useState<number>(16);

const mapCenterRef = useRef<[number, number] | null>(null);
useEffect(() => {
  mapCenterRef.current = mapCenter;
}, [mapCenter]);

// Auto-recenter state
// Initialize to true when route exists so shouldFollow is false on first render
// This ensures the camera fits to route bounds instead of following user
const [isUserInteracting, setIsUserInteracting] = useState(!!route);
const [recenterTimeout, setRecenterTimeout] = useState<NodeJS.Timeout | null>(null);

// Route preview mode - no auto-recenter when a route is first loaded
// Initialize to true when route exists (e.g., from ride details params)
const [isRoutePreviewMode, setIsRoutePreviewMode] = useState(!!route);

const [mapReady, setMapReady] = useState(false);

// Map and camera refs
const mapRef = useRef<MapboxGL.MapView>(null);
const cameraRef = useRef<MapboxGL.Camera>(null);

// Start/end marker overlap detection
const [markersOverlap, setMarkersOverlap] = useState(false);

// Track current zoom level to preserve it when recentering
const currentZoomRef = useRef<number>(16);

// Store last heading when moving (for stable heading-up when stationary)
const lastMovingHeadingRef = useRef<number>(0);

// Pulse animation for stationary state
const pulseAnim = useRef(new Animated.Value(1)).current;

// Crossfade animation for arrow ↔ rider transition (0=arrow, 1=rider)
const crossfadeAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  return () => setMapReady(false);
}, []);


// Get initial location BEFORE rendering map (like MapPickerModal)
useEffect(() => {
  let isMounted = true;

  (async () => {
    try {
      // Request permission if needed
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') return;
      }

      // Validation helpers
      const isSaneCoord = (lng: number, lat: number) =>
        Number.isFinite(lng) && Number.isFinite(lat) &&
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

      const isLikelyIsrael = (lng: number, lat: number) =>
        lat >= 29 && lat <= 34 && lng >= 34 && lng <= 36.5;

      // Fast path first (prevents delays) - but validate!
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords && isMounted) {
        const { longitude: lng, latitude: lat } = last.coords;
        const ageMs = Date.now() - (last.timestamp ?? 0);

        // Accept only if sane + not too old + roughly in Israel
        if (isSaneCoord(lng, lat) && ageMs < 2 * 60 * 1000 && isLikelyIsrael(lng, lat)) {
          if (!mapCenterRef.current) {
            setMapCenter([lng, lat]);
            setMapZoom(16);
          }
          return;
        }
      }

      // Fallback - slower but reliable
      const cur = await Location.getCurrentPositionAsync({});
      if (isMounted) {
        if (!mapCenterRef.current) {
          setMapCenter([cur.coords.longitude, cur.coords.latitude]);
          setMapZoom(16);
        }
      }
    } catch {
      console.log('Could not get location for map center');
    }
  })();

  return () => {
    isMounted = false;
  };
}, []);

// Don't manually update mapCenter when using followUserLocation
// The followUserLocation + followPadding will handle positioning automatically

// Handle map interaction - start timeout for auto-recenter (unless in preview mode)
const handleMapInteraction = () => {
  // Wake brightness if dimmed (tap to wake)
  onWakeBrightness?.();

  // In preview mode, don't override with auto-recenter timer
  if (isRoutePreviewMode) return;

  setIsUserInteracting(true);

  // Clear existing timeout
  if (recenterTimeout) {
    clearTimeout(recenterTimeout);
  }

  // Set new timeout for 5 seconds
  const timeout = setTimeout(() => {
    setIsUserInteracting(false);
  }, 5000);

  setRecenterTimeout(timeout);
};

// Track zoom level from map region changes - update both ref and state
// State is needed so Camera component uses user's zoom level after auto-recenter
const handleRegionDidChange = (feature: GeoJSON.Feature) => {
  if (feature.properties?.zoomLevel) {
    currentZoomRef.current = feature.properties.zoomLevel;
    setMapZoom(feature.properties.zoomLevel);
  }
};

// Handle recenter button press - preserve user's zoom level
const handleRecenter = () => {
  // Clear any pending auto-recenter timeout
  if (recenterTimeout) {
    clearTimeout(recenterTimeout);
    setRecenterTimeout(null);
  }

  setIsRoutePreviewMode(false);  // Exit preview mode
  setIsUserInteracting(false);   // Resume following

  // Explicitly center on user at current zoom level (don't reset to default 16)
  // Use padding to position user at bottom 1/3 of screen
  // Restore heading/pitch based on current mode
  if (cameraRef.current && currentPosition) {
    // Use stable heading (last known good heading when stationary, current GPS heading when moving)
    // This prevents random camera rotation when pressing recenter while stationary
    const stableHeadingForRecenter = debugInfo?.motionState === 'MOVING'
      ? currentPosition.heading
      : lastMovingHeadingRef.current;
    const heading = mode === 'heading-up' ? stableHeadingForRecenter : 0;
    const pitch = 0;

    cameraRef.current.setCamera({
      centerCoordinate: currentPosition.coordinate,
      zoomLevel: currentZoomRef.current,
      heading,
      pitch,
      padding: {
        paddingTop: 400,
        paddingBottom: 100,
        paddingLeft: 50,
        paddingRight: 50,
      },
      animationDuration: 300,
    });
  }
};

// Cleanup timeout on unmount
useEffect(() => {
  return () => {
    if (recenterTimeout) {
      clearTimeout(recenterTimeout);
    }
  };
}, [recenterTimeout]);

// Track previous motion state to detect STATIONARY → MOVING transitions
const prevMotionStateRef = useRef<string | undefined>(debugInfo?.motionState);

// Auto-recenter when user STARTS moving (transition from STATIONARY to MOVING)
// BUT only if user is INSIDE the route bounding box
useEffect(() => {
  const prevState = prevMotionStateRef.current;
  const currState = debugInfo?.motionState;

  // Update ref for next comparison
  prevMotionStateRef.current = currState;

  // Only recenter on actual transition: STATIONARY → MOVING while in preview mode
  // AND only if user is inside the route's bounding box (+2km margin)
  if (isRoutePreviewMode && prevState === 'STATIONARY' && currState === 'MOVING') {
    const isInsideBbox = routeMetrics && currentPosition
      ? isNearRouteArea(currentPosition.coordinate, routeMetrics.bbox)
      : false;

    if (isInsideBbox) {
      handleRecenter();
    }
    // If outside bbox, stay on bounding box view - user must manually recenter
  }
}, [debugInfo?.motionState, isRoutePreviewMode, routeMetrics, currentPosition]);

// Update last known heading only when moving (GPS heading is unreliable when stationary)
useEffect(() => {
  if (debugInfo?.motionState === 'MOVING' && currentPosition?.heading != null) {
    lastMovingHeadingRef.current = currentPosition.heading;
  }
}, [debugInfo?.motionState, currentPosition?.heading]);

// Pulse animation when stationary
useEffect(() => {
  if (debugInfo?.motionState === 'STATIONARY') {
    // Start infinite pulse loop (1.0 → 0.75 → 1.0, 1s period, ease in-out)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  } else {
    // Reset to normal scale when moving
    pulseAnim.setValue(1);
  }
}, [debugInfo?.motionState, pulseAnim]);

// Crossfade between arrow and rider icons on motion state change
useEffect(() => {
  Animated.timing(crossfadeAnim, {
    toValue: debugInfo?.motionState === 'STATIONARY' ? 1 : 0,
    duration: 250,
    useNativeDriver: true,
  }).start();
}, [debugInfo?.motionState, crossfadeAnim]);

// Update current time every 30 seconds
useEffect(() => {
  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }));
  };
  updateTime(); // Initial update
  const interval = setInterval(updateTime, 30000);
  return () => clearInterval(interval);
}, []);

// Update battery level every 60 seconds
useEffect(() => {
  const updateBattery = async () => {
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) {
        setBatteryLevel(Math.round(level * 100));
      }
    } catch {
      // Battery API may not be available on all devices
    }
  };
  updateBattery(); // Initial update
  const interval = setInterval(updateBattery, 60000);
  return () => clearInterval(interval);
}, []);


// Use last known heading when stationary (GPS heading is noisy when not moving)
const stableHeading = debugInfo?.motionState === 'MOVING'
  ? currentPosition?.heading ?? lastMovingHeadingRef.current
  : lastMovingHeadingRef.current;

const cameraBearing = mode === 'heading-up' && currentPosition && !isUserInteracting
  ? stableHeading
  : 0;

const cameraPitch = 0;

// Explicitly reset camera heading to north when switching to north-up mode
// The heading prop alone doesn't work reliably when followUserLocation is active
useEffect(() => {
  if (mode === 'north-up' && cameraRef.current && mapReady) {
    cameraRef.current.setCamera({
      heading: 0,
      pitch: 0,
      animationDuration: 300,
    });
  }
}, [mode, mapReady]);

useEffect(() => {
  if (!cameraRef.current) return;
  if (!mapReady) return;
  if (!currentPosition) return;

  // Don't auto-follow if route exists but we haven't entered preview mode yet
  // This prevents the race condition where auto-follow runs before fitBounds
  // (e.g., when opening a GPX file from external intent)
  if (route && !isRoutePreviewMode) return;

  // Only auto-follow when we are not in manual interaction / preview state
  if (isUserInteracting) return;
  if (isRoutePreviewMode) return;

  // Use padding to position user at bottom 1/3 of screen
  cameraRef.current.setCamera({
    centerCoordinate: currentPosition.coordinate,
    zoomLevel: currentZoomRef.current,
    heading: cameraBearing, // your computed bearing (0 or heading)
    pitch: cameraPitch,
    padding: {
      paddingTop: 400,
      paddingBottom: 100,
      paddingLeft: 50,
      paddingRight: 50,
    },
    animationDuration: 300,
  });
}, [currentPosition, mapReady, isUserInteracting, isRoutePreviewMode, cameraBearing, cameraPitch, route]);




// Convert speed to km/h, but filter out GPS drift
// Show 0 if: speed < 1.0 m/s (3.6 km/h) OR accuracy > 10m
// Indoor GPS can report false speeds of 5-15 km/h due to signal bounce
const rawSpeedKmh = currentPosition ? (currentPosition.speed * 3.6) : 0;
const speedKmh = currentPosition &&
  currentPosition.speed >= 1.0 &&
  currentPosition.accuracy <= 10
  ? rawSpeedKmh
  : 0;
const speedColor =
  speedKmh < 6 ? '#00BFFF' :
  speedKmh < 14 ? '#00FF7F' :
  speedKmh < 22 ? '#FFB000' : '#FF4500';

useEffect(() => {
  if (!currentPosition) {
    setShowSpeed(false);
    return;
  }
  if (!showSpeed && speedKmh >= 1.5) setShowSpeed(true);
  if (showSpeed && speedKmh <= 0.7) setShowSpeed(false);
}, [!!currentPosition, speedKmh, showSpeed]);


// Precompute route metrics when route changes
const routeMetrics = useMemo<RouteMetrics | null>(() => {
  if (!route || route.length < 2) return null;
  return computeRouteMetrics(route, routeElevations);
}, [route, routeElevations]);

// Check if start and end markers overlap based on screen pixel distance
const checkMarkersOverlap = async () => {
  if (!mapRef.current || !route || route.length < 2) {
    setMarkersOverlap(false);
    return;
  }

  try {
    const startCoords = route[0];
    const endCoords = route[route.length - 1];

    const pixel1 = await mapRef.current.getPointInView(startCoords);
    const pixel2 = await mapRef.current.getPointInView(endCoords);

    if (!pixel1 || !pixel2) return;

    const dx = pixel2[0] - pixel1[0];
    const dy = pixel2[1] - pixel1[1];
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    const MIN_PIXEL_DIST = 30; // Threshold for overlap
    setMarkersOverlap(pixelDistance < MIN_PIXEL_DIST);
  } catch (error) {
    console.warn('Failed to calculate marker distance:', error);
    setMarkersOverlap(false);
  }
};

// Fit camera to route bounds when route loads
useEffect(() => {
  if (route && routeMetrics && cameraRef.current && mapReady) {
    const { bbox } = routeMetrics;
    const padding = 60;  // Screen padding

    cameraRef.current.fitBounds(
      [bbox.minLng, bbox.minLat],
      [bbox.maxLng, bbox.maxLat],
      padding,
      1000  // animation duration ms
    );

    // Enter preview mode (no auto-recenter)
    setIsRoutePreviewMode(true);
    setIsUserInteracting(true);

    // Check marker overlap after camera animation
    setTimeout(checkMarkersOverlap, 1100);
  } else if (!route) {
    // Route cleared - exit preview mode
    setIsRoutePreviewMode(false);
    setMarkersOverlap(false);
  }
}, [route, routeMetrics, mapReady]);

// Compute metrics display with distance gating (far vs near route)
const metricsDisplay = useMemo<string | null>(() => {
  if (!routeMetrics || !currentPosition || !route) return null;

  // Check if user is near route area (within bbox + 2km margin)
  const isNear = isNearRouteArea(currentPosition.coordinate, routeMetrics.bbox);

  if (!isNear) {
    // FAR: cheap computation - just distance to start
    const distToStart = computeDistanceToStart(
      currentPosition.coordinate,
      routeMetrics.startPoint
    );
    return formatDistanceToStart(distToStart);
  }

  // NEAR: full metrics (expensive computation)
  const { progressM } = findRouteProgress(
    currentPosition.coordinate,
    route,
    routeMetrics.cumDistances
  );

  const remaining = computeRemainingMetrics(
    routeMetrics,
    progressM,
    currentPosition.speed
  );

  return formatRemainingMetrics(remaining);
}, [routeMetrics, currentPosition, route]);

// Update mapCenter from currentPosition if expo-location hasn't provided one yet
useEffect(() => {
  if (!mapCenter && currentPosition) {
    setMapCenter(currentPosition.coordinate);
    setMapZoom(16);
  }
}, [currentPosition, mapCenter]);


// Don't render map until we have a valid center position
const hasValidCenter = mapCenter !== null;

// Pick ONE camera mode: follow when we have position, controlled otherwise
const shouldFollow =
  mapReady &&
  !!currentPosition &&
  !isUserInteracting &&
  !isRoutePreviewMode &&
  currentPosition.accuracy < 50;

// GPX file picker handler
const handleLoadGpx = async () => {
  if (!onLoadRoute) return;

  setIsLoadingGpx(true);
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'text/xml', 'application/xml', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];

    // Validate file size
    if (file.size && file.size > MAX_GPX_FILE_SIZE) {
      Alert.alert(t('common.error'), t('createRide.where.gpxTooLarge'));
      return;
    }

    // Read and validate GPX content
    const content = await fetch(file.uri).then((r) => r.text());
    if (!isValidGpx(content)) {
      Alert.alert(t('common.error'), t('createRide.where.gpxInvalid'));
      return;
    }

    // Parse coordinates
    const coords = parseGpxCoordinates(content);
    if (coords.length < 2) {
      Alert.alert(t('common.error'), t('createRide.where.gpxNoPoints'));
      return;
    }

    // Compute bbox locally for offline download prompt (before onLoadRoute async chain)
    const metrics = computeRouteMetrics(coords);
    console.log('[GPX] Computed bbox:', metrics.bbox);
    setPendingDownloadBbox(metrics.bbox);

    // Extract name from filename (remove .gpx extension)
    const name = file.name?.replace(/\.gpx$/i, '') || undefined;

    onLoadRoute(coords, name);

    // Show offline download prompt if online
    setRouteName(name || 'Route');
    const online = await isOnline();
    console.log('[GPX] isOnline result:', online);
    if (online) {
      // Small delay to let the route render first
      console.log('[GPX] Scheduling offline prompt in 1.5s');
      setTimeout(() => {
        console.log('[GPX] Setting showOfflinePrompt = true');
        setShowOfflinePrompt(true);
      }, 1500);
    } else {
      console.log('[GPX] Skipping offline prompt - device appears offline');
    }
  } catch (error) {
    console.error('Error loading GPX:', error);
    Alert.alert(t('common.error'), t('createRide.where.gpxInvalid'));
  } finally {
    setIsLoadingGpx(false);
  }
};

return (
  <View style={styles.container}>
    {hasValidCenter ? (
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        pitchEnabled={false}
        rotateEnabled={mode === 'heading-up'}
        onTouchStart={handleMapInteraction}
        onDidFinishLoadingMap={() => {
          setMapReady(true);
          checkMarkersOverlap();
        }}
        onRegionDidChange={(feature) => {
          handleRegionDidChange(feature);
          // Re-check overlap when zoom changes
          if (route) checkMarkersOverlap();
        }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: mapCenter!,
            zoomLevel: mapZoom,
            pitch: 0,
            heading: 0,
          }}
          // Don't use declarative props (centerCoordinate, zoomLevel, heading, pitch)
          // They override setCamera() calls which include proper padding/zoom
          // All camera positioning is done via setCamera() to preserve user's zoom level
          animationDuration={300}
          followUserLocation={false}
        />

        {/* Base tiles */}
        <MapboxGL.RasterSource
          id="navigation-ihm-base"
          tileUrlTemplates={[baseTiles]}
          tileSize={256}
        >
          <MapboxGL.RasterLayer
            id="navigation-ihm-base-layer"
            sourceID="navigation-ihm-base"
          />
        </MapboxGL.RasterSource>

        {/* Trail overlay tiles - only for hiking style (MTB map has its own trail styling) */}
        {config.mapStyle === 'hiking' && (
          <MapboxGL.RasterSource
            id="navigation-ihm-trails"
            tileUrlTemplates={[trailTiles]}
            tileSize={256}
            maxZoomLevel={18}
            minZoomLevel={7}
          >
            <MapboxGL.RasterLayer
              id="navigation-ihm-trails-layer"
              sourceID="navigation-ihm-trails"
              style={{ rasterOpacity: 1.0 }}
            />
          </MapboxGL.RasterSource>
        )}

        {/* Route LineLayer (if provided) */}
        {route && (
          <MapboxGL.ShapeSource
            id="navigation-route-source"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: route,
              },
              properties: {},
            }}
          >
            <MapboxGL.LineLayer
              id="navigation-route-line"
              style={{
                lineColor: '#7B2CBF',
                lineWidth: 5,
                lineOpacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Start and End Point Markers - Conditional rendering based on overlap */}
        {route && route.length >= 2 && (markersOverlap ? (
          // Offset circles when overlapping to show both colors
          <>
            <MapboxGL.ShapeSource
              id="nav-overlap-start-marker"
              shape={{ type: 'Point', coordinates: route[0] }}
            >
              <MapboxGL.CircleLayer
                id="nav-overlap-start-circle"
                style={{
                  circleRadius: 10,
                  circleColor: '#FF8C00',
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#FFFFFF',
                  circleTranslate: [-4, 0], // Offset left by 4 pixels
                }}
              />
            </MapboxGL.ShapeSource>

            <MapboxGL.ShapeSource
              id="nav-overlap-end-marker"
              shape={{ type: 'Point', coordinates: route[route.length - 1] }}
            >
              <MapboxGL.CircleLayer
                id="nav-overlap-end-circle"
                style={{
                  circleRadius: 10,
                  circleColor: '#DC143C',
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#FFFFFF',
                  circleTranslate: [4, 0], // Offset right by 4 pixels
                }}
              />
            </MapboxGL.ShapeSource>
          </>
        ) : (
          // Separate markers when not overlapping
          <>
            {/* Start Point Marker (orange) */}
            <MapboxGL.ShapeSource
              id="nav-start-point-source"
              shape={{ type: 'Point', coordinates: route[0] }}
            >
              <MapboxGL.CircleLayer
                id="nav-start-point-circle"
                style={{
                  circleRadius: 8,
                  circleColor: '#FF8C00',
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#FFFFFF',
                }}
              />
            </MapboxGL.ShapeSource>

            {/* End Point Marker (red) */}
            <MapboxGL.ShapeSource
              id="nav-end-point-source"
              shape={{ type: 'Point', coordinates: route[route.length - 1] }}
            >
              <MapboxGL.CircleLayer
                id="nav-end-point-circle"
                style={{
                  circleRadius: 8,
                  circleColor: '#DC143C',
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#FFFFFF',
                }}
              />
            </MapboxGL.ShapeSource>
          </>
        ))}

        {/* User Location with heading indicator */}
        {/* Custom user heading arrow - only render when map is ready and coordinates are valid */}
        {mapReady && currentPosition &&
         Number.isFinite(currentPosition.coordinate[0]) &&
         Number.isFinite(currentPosition.coordinate[1]) && (
          <MapboxGL.MarkerView
            id="user-heading-marker"
            coordinate={currentPosition.coordinate}
            allowOverlap={true}
            allowOverlapWithPuck={true}
          >
            {/* Fixed-size container for crossfade between arrow and rider icons */}
            <View style={styles.userHeadingMarker}>
              {/* Arrow icon (moving state) - fades out when stationary */}
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: crossfadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                  transform: [
                    { rotate: mode === 'north-up' ? `${stableHeading}deg` : '0deg' },
                  ],
                }}
              >
                <Icon source="navigation" size={35} color="#ff6b35" />
              </Animated.View>

              {/* Rider icon (stationary state) - fades in with pulse when stationary */}
              <Animated.View
                style={{
                  position: 'absolute',
                  opacity: crossfadeAnim,
                  transform: [{ scale: pulseAnim }],
                }}
              >
                <Icon source="bike" size={35} color="#ff6b35" />
              </Animated.View>
            </View>
          </MapboxGL.MarkerView>
        )}
      </MapboxGL.MapView>
    ) : (
      <View style={styles.map} />
    )}

    {/* Mode Toggle Button (top-right, compass position) - Icon only */}
    <View style={styles.modeToggleButton}>
      <TouchableOpacity
        onPress={onToggleMode}
        activeOpacity={0.7}
        style={{ backgroundColor: 'transparent' }}
      >
        <View style={mode === 'north-up' ? styles.northUpIcon : undefined}>
          <Icon
            source={mode === 'north-up' ? 'compass' : 'ship-wheel'}
            size={40}
            color={mode === 'north-up' ? '#ff0f00' : '#ff6b35'}  // Red compass for north-up, orange ship wheel for heading-up
          />
        </View>

      </TouchableOpacity>
    </View >

    {/* Tiny Speed Pill (bottom-left) - Only show when moving */}
    {
      currentPosition && showSpeed && (
        <View style={styles.speedBadge}>
          <Text style={[styles.speedValue, { color: speedColor }]}>{String(Math.round(speedKmh)).padStart(2, '0')}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )
    }

    {/* Top Info Bar - Always shown (content changes if GPS not ready) */}
    <View style={styles.topInfoBar}>
      {/* Left: Route metrics or Free nav or GPS acquiring */}
      <Text style={styles.topInfoMetrics} numberOfLines={1}>
        {!currentPosition
          ? 'Acquiring GPS…'
          : route
            ? (metricsDisplay || 'Route loaded')
            : t('navigation.freeNav')}
      </Text>

      {/* Right: Time & Battery */}
      <View style={styles.topInfoRight}>
        <Text style={styles.topInfoTime}>{currentTime}</Text>
        {batteryLevel !== null && (
          <Text style={styles.topInfoBattery}>
            <Text style={styles.topInfoBatteryIcon}>🔋</Text> {batteryLevel}%
          </Text>
        )}
      </View>
    </View>

    {/* Dev Debug Row - Only in __DEV__ */}
    {__DEV__ && debugInfo && (
      <View style={styles.debugRow}>
        <Text style={styles.debugText}>
          DBG: {debugInfo.motionState || 'N/A'} | dim={debugInfo.autoDimEnabled ? 'ON' : 'OFF'}({debugInfo.brightnessTarget != null ? debugInfo.brightnessTarget.toFixed(2) : 'N/A'}) | br={debugInfo.brightnessCurrent != null ? debugInfo.brightnessCurrent.toFixed(2) : 'N/A'} | dimmed={debugInfo.isDimmed ? 'Y' : 'N'}
        </Text>
      </View>
    )}


    {/* Recenter Button - show when not following user */}
    {
      !shouldFollow && currentPosition && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleRecenter}
          activeOpacity={0.7}
        >
          <Icon source="crosshairs-gps" size={28} color="#2196F3" />
        </TouchableOpacity>
      )
    }

    {/* Route Action Button (bottom-right) - Load GPX or Clear Route */}
    {
      (onLoadRoute || onClearRoute) && (
        <TouchableOpacity
          style={styles.routeActionButton}
          onPress={route ? onClearRoute : handleLoadGpx}
          disabled={isLoadingGpx}
          activeOpacity={0.7}
        >
          {isLoadingGpx ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Icon
              source={route ? 'close-circle' : 'folder-open'}
              size={32}
              color={route ? '#ff4444' : '#4CAF50'}
            />
          )}
        </TouchableOpacity>
      )
    }

    {/* No position indicator */}
    {
      !currentPosition && (
        <View style={styles.noPositionOverlay}>
          <Icon source="map-marker-off" size={48} color="#888" />
          <Text style={styles.noPositionText}>
            Waiting for GPS signal...
          </Text>
        </View>
      )
    }

    {/* Offline Map Download Prompt */}
    {showOfflinePrompt && pendingDownloadBbox && (
      <OfflineMapDownload
        bbox={pendingDownloadBbox}
        routeName={routeName}
        language={i18n.language === 'he' ? 'he' : 'en'}
        mapStyle={config.mapStyle}
        onDismiss={() => {
          setShowOfflinePrompt(false);
          setPendingDownloadBbox(null);
        }}
      />
    )}
  </View >
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  northUpIcon: {
    transform: [{ rotate: '-45deg' }],
  },
  userHeadingMarker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleButton: {
    position: 'absolute',
    top: 6,  // Centered in top info bar (52px height)
    right: 8,
    padding: 0,
    backgroundColor: 'transparent',  // Transparent background, no circle
    elevation: 15,  // Must be higher than top info bar (elevation: 10)
    zIndex: 15,     // For iOS
  },

  speedBadge: {
    position: 'absolute',
    left: 16,
    bottom: 40,
    width: 72,
    height: 72,
    borderRadius: 36,

    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderColor: 'rgba(255,165,0,0.85)',

    elevation: 12, // Android shadow
    shadowOpacity: 0.45, // iOS shadow
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },

  speedValue: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    color: '#FFB000',
    fontVariant: ['tabular-nums'],
  },

  speedUnit: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  topInfoBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: '#121212',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingRight: 56, // Leave space for mode toggle button
    zIndex: 10,
    elevation: 10,
  },
  topInfoMetrics: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  topInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topInfoTime: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  topInfoBattery: {
    color: '#ffffff',
    fontSize: 15,
  },
  topInfoBatteryIcon: {
    color: '#ff6b35',
  },
  debugRow: {
    position: 'absolute',
    top: 52,  // Right below main info bar
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 9,
    elevation: 9,
  },
  debugText: {
    color: '#aaaaaa',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 88,  // Above route action button
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  routeActionButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  noPositionOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -40 }],
    alignItems: 'center',
    gap: 8,
  },
  noPositionText: {
    color: '#888',
    fontSize: 14,
  },
});
