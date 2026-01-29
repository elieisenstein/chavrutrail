// NavigationMapView.tsx
// Specialized map component for navigation with North-Up and Heading-Up modes

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon, useTheme } from 'react-native-paper';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { getIsraelHikingTiles } from '../lib/mapbox';
import { NavigationMode, NavigationPosition } from '../app/state/NavigationContext';

type NavigationMapViewProps = {
  currentPosition: NavigationPosition | null;
  route: [number, number][] | null;
  mode: NavigationMode;
  onToggleMode: () => void;
  totalDistanceMeters?: number;  // Optional for free navigation mode
  elapsedTimeMs?: number;         // Optional for free navigation mode
};

export default function NavigationMapView({
  currentPosition,
  route,
  mode,
  onToggleMode,
  totalDistanceMeters,
  elapsedTimeMs,
}: NavigationMapViewProps) {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
  );

  // IMPORTANT: Start as null, so we don't render a "default Israel view" first (like MapPickerModal)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number | null>(null);

  // Auto-recenter state
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [recenterTimeout, setRecenterTimeout] = useState<NodeJS.Timeout | null>(null);

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

        // Fast path first (prevents delays)
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords && isMounted) {
          setMapCenter([last.coords.longitude, last.coords.latitude]);
          setMapZoom(12);
          return;
        }

        // Fallback
        const cur = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setMapCenter([cur.coords.longitude, cur.coords.latitude]);
          setMapZoom(12);
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

  // Handle map interaction - start timeout for auto-recenter
  const handleMapInteraction = () => {
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (recenterTimeout) {
        clearTimeout(recenterTimeout);
      }
    };
  }, [recenterTimeout]);

  const cameraBearing = mode === 'heading-up' && currentPosition && !isUserInteracting
    ? currentPosition.heading
    : 0;

  const cameraPitch = mode === 'heading-up' && !isUserInteracting ? 45 : 0;

  // Convert speed to km/h, but filter out GPS drift
  // Show 0 if: speed < 0.5 m/s (1.8 km/h) OR accuracy > 20m
  const rawSpeedKmh = currentPosition ? (currentPosition.speed * 3.6) : 0;
  const speedKmh = currentPosition &&
                    currentPosition.speed >= 0.5 &&
                    currentPosition.accuracy <= 20
    ? rawSpeedKmh
    : 0;

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    } else {
      return `${meters.toFixed(0)} m`;
    }
  };

  // Format time
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <View style={styles.container}>
      {mapCenter && mapZoom !== null ? (
        <MapboxGL.MapView
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Light}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={false}
          pitchEnabled={mode === 'heading-up'}
          rotateEnabled={mode === 'heading-up'}
          onTouchStart={handleMapInteraction}
        >
          <MapboxGL.Camera
            zoomLevel={mapZoom}
            centerCoordinate={currentPosition && !isUserInteracting ? undefined : mapCenter}
            pitch={cameraPitch}
            heading={cameraBearing}
            animationDuration={currentPosition && !isUserInteracting ? 300 : 0}
            followUserLocation={!!currentPosition && !isUserInteracting}
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
          <MapboxGL.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
            minDisplacement={1}
          />
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
          <Icon
            source={mode === 'north-up' ? 'compass' : 'ship-wheel'}
            size={40}
            color={mode === 'north-up' ? '#ff0000' : '#ff6b35'}  // Red compass needle for north-up, orange ship wheel for heading-up
          />
        </TouchableOpacity>
      </View>

      {/* Stats Overlay (top) - Only show in route navigation mode */}
      {currentPosition && totalDistanceMeters !== undefined && elapsedTimeMs !== undefined && (
        <View style={[styles.statsOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(totalDistanceMeters)}</Text>
            <Text style={styles.statLabel}>{t('navigation.distance')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(elapsedTimeMs)}</Text>
            <Text style={styles.statLabel}>{t('navigation.time')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{speedKmh.toFixed(1)} km/h</Text>
            <Text style={styles.statLabel}>{t('navigation.speed')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>±{currentPosition.accuracy.toFixed(0)}m</Text>
            <Text style={styles.statLabel}>{t('navigation.accuracy')}</Text>
          </View>
        </View>
      )}

      {/* Speed/Accuracy Overlay (top) - Show in free navigation mode */}
      {currentPosition && totalDistanceMeters === undefined && elapsedTimeMs === undefined && (
        <View style={[styles.freeNavStatsOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.85)' }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{speedKmh.toFixed(1)} km/h</Text>
            <Text style={styles.statLabel}>{t('navigation.speed')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>±{currentPosition.accuracy.toFixed(0)}m</Text>
            <Text style={styles.statLabel}>{t('navigation.accuracy')}</Text>
          </View>
        </View>
      )}

      {/* No position indicator */}
      {!currentPosition && (
        <View style={styles.noPositionOverlay}>
          <Icon source="map-marker-off" size={48} color="#888" />
          <Text style={styles.noPositionText}>
            Waiting for GPS signal...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  modeToggleButton: {
    position: 'absolute',
    top: 56,  // Top-right corner where Mapbox compass was
    right: 16,
    padding: 0,
    backgroundColor: 'transparent',  // Transparent background, no circle
    elevation: 5,  // Must be higher than stats overlay (elevation: 4) to render on top
    zIndex: 5,     // For iOS
  },
  statsOverlay: {
    position: 'absolute',
    top: 48,  // Lower to avoid Android status bar
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  freeNavStatsOverlay: {
    position: 'absolute',
    top: 48,  // Same as statsOverlay
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',  // Center the 2 stats
    alignItems: 'center',
    gap: 16,  // Gap between speed and accuracy
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    color: '#aaaaaa',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#555555',
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
