// NavigationMapView.tsx
// Specialized map component for navigation with North-Up and Heading-Up modes

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon, useTheme } from 'react-native-paper';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import { getIsraelHikingTiles } from '../lib/mapbox';
import { NavigationMode, NavigationPosition } from '../app/state/NavigationContext';

type NavigationMapViewProps = {
  currentPosition: NavigationPosition | null;
  route: [number, number][] | null;
  mode: NavigationMode;
  onToggleMode: () => void;
};

export default function NavigationMapView({
  currentPosition,
  route,
  mode,
  onToggleMode,
}: NavigationMapViewProps) {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
  );

  // Default center (Israel center) if no position yet
  const centerCoordinate = currentPosition
    ? currentPosition.coordinate
    : [34.75, 31.5];

  const cameraBearing = mode === 'heading-up' && currentPosition
    ? currentPosition.heading
    : 0;

  const cameraPitch = mode === 'heading-up' ? 45 : 0;

  // Convert speed to km/h
  const speedKmh = currentPosition ? (currentPosition.speed * 3.6) : 0;

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Light}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={mode === 'north-up'}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapboxGL.Camera
          centerCoordinate={centerCoordinate}
          zoomLevel={16}
          pitch={cameraPitch}
          heading={cameraBearing}
          animationDuration={300}
          followUserLocation={!!currentPosition}
          followUserMode={MapboxGL.UserTrackingMode.FollowWithCourse}
          // Offset camera to show more ahead (bottom-third positioning)
          followPadding={{
            paddingTop: 400,     // More space ahead
            paddingBottom: 100,  // Less space behind
            paddingLeft: 50,
            paddingRight: 50,
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

      {/* Mode Toggle Button (top-right) */}
      <TouchableOpacity
        style={[styles.modeToggleButton, { backgroundColor: theme.colors.primary }]}
        onPress={onToggleMode}
        activeOpacity={0.7}
      >
        <Icon
          source={mode === 'north-up' ? 'compass-outline' : 'compass'}
          size={28}
          color="#ffffff"
        />
        <Text style={styles.modeButtonText}>
          {mode === 'north-up' ? t('navigation.northUp') : t('navigation.headingUp')}
        </Text>
      </TouchableOpacity>

      {/* Stats Overlay (bottom) */}
      {currentPosition && (
        <View style={[styles.statsOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={styles.statItem}>
            <Icon source="speedometer" size={20} color="#ffffff" />
            <Text style={styles.statLabel}>{t('navigation.speed')}</Text>
            <Text style={styles.statValue}>
              {speedKmh.toFixed(1)} km/h
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Icon source="crosshairs-gps" size={20} color="#ffffff" />
            <Text style={styles.statLabel}>{t('navigation.accuracy')}</Text>
            <Text style={styles.statValue}>
              ±{currentPosition.accuracy.toFixed(0)}m
            </Text>
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
    top: 16,
    right: 16,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#aaaaaa',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statDivider: {
    width: 1,
    height: 40,
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
