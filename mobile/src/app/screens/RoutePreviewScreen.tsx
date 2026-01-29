import React, { useState, useRef } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import MapboxGL from "@rnmapbox/maps";
import { getIsraelHikingTiles } from "../../lib/mapbox";
import { downloadGpxFile } from "../../lib/gpxDownload";

type RoutePreviewParams = {
  RoutePreview: {
    coordinates: [number, number][];
    gpxUrl?: string;
    originalFilename?: string;
  };
};

export default function RoutePreviewScreen() {
  const route = useRoute<RouteProp<RoutePreviewParams, "RoutePreview">>();
  const { coordinates, gpxUrl, originalFilename } = route.params;
  const [downloading, setDownloading] = useState(false);
  const [markersOverlap, setMarkersOverlap] = useState(false);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === "he" ? "he" : "en"
  );

  // Extract start and end coordinates for markers
  const startCoords = coordinates[0];
  const endCoords = coordinates[coordinates.length - 1];

  async function handleDownload() {
    if (!gpxUrl) return;

    setDownloading(true);
    try {
      const result = await downloadGpxFile(gpxUrl, originalFilename ?? null, t);
      if (!result.success && result.error) {
        Alert.alert(t("common.error"), result.error);
      }
    } finally {
      setDownloading(false);
    }
  }

  // Check if start and end markers overlap based on screen pixel distance
  const checkMarkersOverlap = async () => {
    if (!mapRef.current) return;

    try {
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

  // Handle map load event
  const handleMapLoad = () => {
    checkMarkersOverlap();
  };

  // Calculate bounding box for camera
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const bounds = {
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
  };

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {},
      },
    ],
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Light}
        compassEnabled
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={handleMapLoad}
      >
        <MapboxGL.Camera
          bounds={bounds}
          padding={{ paddingTop: 60, paddingBottom: 60, paddingLeft: 60, paddingRight: 60 }}
          animationDuration={0}
        />

        {/* Israel Hiking base tiles */}
        <MapboxGL.RasterSource
          id="ihm-base"
          tileUrlTemplates={[baseTiles]}
          tileSize={256}
        >
          <MapboxGL.RasterLayer id="ihm-base-layer" sourceID="ihm-base" />
        </MapboxGL.RasterSource>

        {/* Trail overlay tiles */}
        <MapboxGL.RasterSource
          id="ihm-trails"
          tileUrlTemplates={[trailTiles]}
          tileSize={256}
          maxZoomLevel={18}
          minZoomLevel={7}
        >
          <MapboxGL.RasterLayer
            id="ihm-trails-layer"
            sourceID="ihm-trails"
            style={{ rasterOpacity: 1.0 }}
          />
        </MapboxGL.RasterSource>

        {/* GPX Route Line */}
        <MapboxGL.ShapeSource id="gpx-route-source" shape={geojson}>
          <MapboxGL.LineLayer
            id="gpx-route-line"
            style={{
              lineColor: "#7B2CBF",
              lineWidth: 4,
              lineOpacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </MapboxGL.ShapeSource>

        {/* Start and End Point Markers - Conditional rendering based on overlap */}
        {startCoords && endCoords && (markersOverlap ? (
          // Offset circles when overlapping to show both colors
          <>
            <MapboxGL.ShapeSource
              id="overlap-start-marker"
              shape={{ type: 'Point', coordinates: startCoords }}
            >
              <MapboxGL.CircleLayer
                id="overlap-start-circle"
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
              id="overlap-end-marker"
              shape={{ type: 'Point', coordinates: endCoords }}
            >
              <MapboxGL.CircleLayer
                id="overlap-end-circle"
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
            {/* Start Point Marker */}
            <MapboxGL.ShapeSource
              id="start-point-source"
              shape={{ type: 'Point', coordinates: startCoords }}
            >
              <MapboxGL.CircleLayer
                id="start-point-circle"
                style={{
                  circleRadius: 8,
                  circleColor: '#FF8C00',
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#FFFFFF',
                }}
              />
            </MapboxGL.ShapeSource>

            {/* End Point Marker */}
            <MapboxGL.ShapeSource
              id="end-point-source"
              shape={{ type: 'Point', coordinates: endCoords }}
            >
              <MapboxGL.CircleLayer
                id="end-point-circle"
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
      </MapboxGL.MapView>

      {/* Download button overlay at bottom */}
      {gpxUrl && (
        <View
          style={[
            styles.downloadBar,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Button
            mode="contained"
            icon="download"
            onPress={handleDownload}
            loading={downloading}
            disabled={downloading}
          >
            {t("rideDetails.downloadGpx")}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  downloadBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
});
