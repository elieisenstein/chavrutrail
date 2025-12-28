// src/components/MapView.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import { getIsraelHikingTiles } from '../lib/mapbox';

type MapViewProps = {
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  markers?: Array<{ coordinate: [number, number]; id: string }>;
  onMapPress?: (coordinate: [number, number]) => void;
  interactive?: boolean;
  height?: number;
  showUserLocation?: boolean;
};

export default function IsraelHikingMapView({
  center = [34.75, 31.5], // Israel center [lng, lat]
  zoom = 8,
  markers = [],
  onMapPress,
  interactive = true,
  height = 300,
  showUserLocation = false,
}: MapViewProps) {
  const { i18n } = useTranslation();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
  );

  console.log("MAPBOX_ACCESS_TOKEN (process.env):", process.env.MAPBOX_ACCESS_TOKEN ? "SET" : "MISSING");

  return (
    <View style={[styles.container, { height }]}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Outdoors}
        onPress={(e) => {
          if (onMapPress && interactive) {
            const g = e.geometry;
            
            // Only handle Point geometry which has coordinates
            if (!g || g.type !== "Point") return;
            
            // Now TypeScript knows coordinates exists
            const [lng, lat] = g.coordinates;
            onMapPress([lng, lat]);
          }
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={zoom}
          centerCoordinate={center}
          animationDuration={0}
        />

        {/* Israel Hiking Map Base Layer */}
        <MapboxGL.RasterSource
          id="israel-hiking-base"
          tileUrlTemplates={[baseTiles]}
          tileSize={256}
        >
          <MapboxGL.RasterLayer
            id="ihm-base-layer"
            sourceID="israel-hiking-base"
            style={{ rasterOpacity: 1 }}
          />
        </MapboxGL.RasterSource>

        {/* Israel Hiking Trails Overlay */}
        <MapboxGL.RasterSource
          id="israel-trails"
          tileUrlTemplates={[trailTiles]}
          tileSize={256}
        >
          <MapboxGL.RasterLayer
            id="trails-layer"
            sourceID="israel-trails"
            style={{ rasterOpacity: 0.85 }}
          />
        </MapboxGL.RasterSource>

        {/* User Location */}
        {showUserLocation && (
          <MapboxGL.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}

        {/* Markers */}
        {markers.map((marker) => (
          <MapboxGL.PointAnnotation
            key={marker.id}
            id={marker.id}
            coordinate={marker.coordinate}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker} />
            </View>
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});
