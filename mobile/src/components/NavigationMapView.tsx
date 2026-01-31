// NavigationMapView.tsx
// Specialized map component for navigation with North-Up and Heading-Up modes

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import { Text, Icon, useTheme, ActivityIndicator } from 'react-native-paper';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as Battery from 'expo-battery';
import { getIsraelHikingTiles } from '../lib/mapbox';
import { NavigationMode, NavigationPosition, DebugInfo } from '../app/state/NavigationContext';
import {
  computeRouteMetrics,
  findRouteProgress,
  computeRemainingMetrics,
  formatRemainingMetrics,
  isNearRouteArea,
  computeDistanceToStart,
  formatDistanceToStart,
  RouteMetrics,
} from '../lib/routeMetrics';
import { isValidGpx, parseGpxCoordinates, MAX_GPX_FILE_SIZE } from '../lib/gpx';

type NavigationMapViewProps = {
  currentPosition: NavigationPosition | null;
  route: [number, number][] | null;
  routeElevations?: number[] | null;  // Elevation at each route point for ascent calculations
  mode: NavigationMode;
  onToggleMode: () => void;
  onLoadRoute?: (coords: [number, number][], name?: string) => void;
  onClearRoute?: () => void;
  debugInfo?: DebugInfo;  // For dev debug row
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
}: NavigationMapViewProps) {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const [isLoadingGpx, setIsLoadingGpx] = useState(false);
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
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

  // Camera ref for fitBounds
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Track current zoom level to preserve it when recentering
  const currentZoomRef = useRef<number>(16);

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

  // Track zoom level from map region changes
  const handleRegionDidChange = (feature: GeoJSON.Feature) => {
    if (feature.properties?.zoomLevel) {
      currentZoomRef.current = feature.properties.zoomLevel;
    }
  };

  // Handle recenter button press - preserve user's zoom level
  const handleRecenter = () => {
    setIsRoutePreviewMode(false);  // Exit preview mode
    setIsUserInteracting(false);   // Resume following

    // Explicitly center on user at current zoom level (don't reset to default 16)
    // Use padding to position user at bottom 1/3 of screen
    // Restore heading/pitch based on current mode
    if (cameraRef.current && currentPosition) {
      const heading = mode === 'heading-up' ? currentPosition.heading : 0;
      const pitch = mode === 'heading-up' ? 45 : 0;

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

  // Hide Android status bar when GPS is available (our top info bar replaces it)
  useEffect(() => {
    if (currentPosition) {
      StatusBar.setHidden(true, 'fade');
    } else {
      StatusBar.setHidden(false, 'fade');
    }
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, [currentPosition]);

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

    // Only auto-follow when we are not in manual interaction / preview state
    if (isUserInteracting) return;

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
  }, [currentPosition, mapReady, isUserInteracting, cameraBearing, cameraPitch]);


  const cameraBearing = mode === 'heading-up' && currentPosition && !isUserInteracting
    ? currentPosition.heading
    : 0;

  const cameraPitch = mode === 'heading-up' && !isUserInteracting ? 45 : 0;

  // Convert speed to km/h, but filter out GPS drift
  // Show 0 if: speed < 1.0 m/s (3.6 km/h) OR accuracy > 10m
  // Indoor GPS can report false speeds of 5-15 km/h due to signal bounce
  const rawSpeedKmh = currentPosition ? (currentPosition.speed * 3.6) : 0;
  const speedKmh = currentPosition &&
    currentPosition.speed >= 1.0 &&
    currentPosition.accuracy <= 10
    ? rawSpeedKmh
    : 0;

  // Precompute route metrics when route changes
  const routeMetrics = useMemo<RouteMetrics | null>(() => {
    if (!route || route.length < 2) return null;
    return computeRouteMetrics(route, routeElevations);
  }, [route, routeElevations]);

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
    } else if (!route) {
      // Route cleared - exit preview mode
      setIsRoutePreviewMode(false);
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
  const shouldFollow = mapReady && !!currentPosition && !isUserInteracting && currentPosition.accuracy < 50;

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

      // Extract name from filename (remove .gpx extension)
      const name = file.name?.replace(/\.gpx$/i, '') || undefined;

      onLoadRoute(coords, name);
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
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Light}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          pitchEnabled={mode === 'heading-up'}
          rotateEnabled={mode === 'heading-up'}
          onTouchStart={handleMapInteraction}
          onDidFinishLoadingMap={() => setMapReady(true)}
          onRegionDidChange={handleRegionDidChange}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            // Pick ONE camera mode: follow when we have position, controlled otherwise
            defaultSettings={{
              centerCoordinate: mapCenter!,
              zoomLevel: mapZoom,
              pitch: 0,
              heading: 0,
            }}
            // Only drive center/zoom when NOT following (avoid conflict!)
            centerCoordinate={shouldFollow ? undefined : mapCenter!}
            zoomLevel={shouldFollow ? undefined : mapZoom}
            pitch={cameraPitch}
            heading={cameraBearing}
            animationDuration={300}
            //followUserLocation={shouldFollow}
            followUserLocation={false}
            followUserMode={
              mode === 'heading-up' && !isUserInteracting
                ? MapboxGL.UserTrackingMode.FollowWithCourse
                : MapboxGL.UserTrackingMode.Follow
            }
            followPadding={{
              paddingTop: 400,     // More space ahead (user at bottom 1/3)
              paddingBottom: 100,  // Less space behind
              paddingLeft: 50,     // Centered horizontally
              paddingRight: 50,    // Centered horizontally
            }}
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

          {/* Trail overlay tiles */}
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

          {/* User Location with heading indicator */}
          {/*}
          <MapboxGL.UserLocation
            visible={true}
            showsUserHeadingIndicator={false}
            minDisplacement={1}
          />
            */}
          {/* Custom user heading arrow */}
          {currentPosition && (
            <MapboxGL.PointAnnotation
              id="user-heading-marker"
              coordinate={currentPosition.coordinate}
            >
              <View
                style={[
                  styles.userHeadingMarker,
                  mode === 'north-up'
                    ? { transform: [{ rotate: `${currentPosition.heading ?? 0}deg` }] }
                    : { transform: [{ rotate: '0deg' }] },
                ]}
              >
                <Icon source="navigation" size={28} color="#ff6b35" />
              </View>
            </MapboxGL.PointAnnotation>
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
              source={mode === 'north-up' ? 'navigation-variant' : 'ship-wheel'}
              size={40}
              color={mode === 'north-up' ? '#ff0f00' : '#ff6b35'}  // Red navigation arrow for north-up, orange ship wheel for heading-up
            />
          </View>

        </TouchableOpacity>
      </View >

      {/* Tiny Speed Pill (bottom-left) - Only show when moving */}
      {
        currentPosition && speedKmh > 0 && (
          <View style={styles.speedPill}>
            <Text style={styles.speedPillText}>{speedKmh.toFixed(0)} km/h</Text>
          </View>
        )
      }

      {/* Top Info Bar - Show when GPS available */}
      {currentPosition && (
        <>
          <View style={styles.topInfoBar}>
            {/* Left: Route metrics or Free nav */}
            <Text style={styles.topInfoMetrics} numberOfLines={1}>
              {route ? (metricsDisplay || 'Route loaded') : t('navigation.freeNav')}
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
        </>
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

  speedPill: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  speedPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
