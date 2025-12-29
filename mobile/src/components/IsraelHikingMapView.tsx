// src/components/IsraelHikingMapView.tsx
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
  
  // We need BOTH baseTiles and trailTiles
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
  );

  return (
    <View style={[styles.container, { height }]}>
      <MapboxGL.MapView
        style={styles.map}
        // Using Light style allows our raster tiles to be the primary focus
        styleURL={MapboxGL.StyleURL.Light}
        onPress={(e) => {
          if (onMapPress && interactive) {
            const g = e.geometry;
            if (!g || g.type !== "Point") return;
            const [lng, lat] = g.coordinates;
            onMapPress([lng, lat]);
          }
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapboxGL.Camera
          zoomLevel={zoom}
          centerCoordinate={center}
          animationDuration={0}
        />

        {/* 1. BASE LAYER: The actual topographic map background */}
        <MapboxGL.RasterSource
          id="israel-hiking-base"
          tileUrlTemplates={[baseTiles]}
          tileSize={256}
        >
          <MapboxGL.RasterLayer
            id="hiking-base-layer"
            sourceID="israel-hiking-base"
          />
        </MapboxGL.RasterSource>

        {/* 2. TRAILS LAYER: The hiking/MTB trail overlays */}
        <MapboxGL.RasterSource
          id="israel-trails-overlay"
          tileUrlTemplates={[trailTiles]}
          tileSize={256}
          maxZoomLevel={18}
          minZoomLevel={7}
        >
          <MapboxGL.RasterLayer
            id="trails-overlay-layer"
            sourceID="israel-trails-overlay"
            style={{ rasterOpacity: 1.0 }}
          />
        </MapboxGL.RasterSource>

        {/* 3. USER LOCATION */}
        {showUserLocation && (
          <MapboxGL.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}

        {/* 4. MARKERS: Using ShapeSource for reliable rendering on raster tiles */}
        {markers.length > 0 && (
          <MapboxGL.ShapeSource
            id="markers-source"
            shape={{
              type: "FeatureCollection",
              features: markers.map((m) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: m.coordinate },
                properties: { id: m.id },
              })),
            }}
          >
            <MapboxGL.CircleLayer
              id="markers-layer"
              style={{
                circleRadius: 8,
                circleColor: "#ff4444",
                circleStrokeWidth: 2,
                circleStrokeColor: "#ffffff",
                circlePitchAlignment: "map",
              }}
            />
          </MapboxGL.ShapeSource>
        )}
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
});
