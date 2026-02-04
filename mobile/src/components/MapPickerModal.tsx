// src/components/MapPickerModal.tsx
import React, { useState, useEffect } from "react";
import { View, StyleSheet, Modal } from "react-native";
import { Button, Text, useTheme, IconButton } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { getIsraelHikingTiles } from "../lib/mapbox";
import { useNavigation } from "../app/state/NavigationContext";

type MapPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
};

function hasNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export default function MapPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: MapPickerModalProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const { config } = useNavigation();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === "he" ? "he" : "en",
    config.mapStyle
  );

  const [selectedLat, setSelectedLat] = useState<number | undefined>(initialLat);
  const [selectedLng, setSelectedLng] = useState<number | undefined>(initialLng);

  // IMPORTANT: Start as null, so we don't render a "default Israel view" first.
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(
    hasNumber(initialLat) && hasNumber(initialLng) ? [initialLng, initialLat] : null
  );
  const [mapZoom, setMapZoom] = useState<number | null>(
    hasNumber(initialLat) && hasNumber(initialLng) ? 12 : null
  );

  // Whenever modal opens, compute initial center/zoom BEFORE rendering the map.
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;

    const setFromLatLng = (lat: number, lng: number) => {
      if (!isMounted) return;
      setMapCenter([lng, lat]);
      setMapZoom(12);

      // If no selected pin yet, initialize it to the same point
      if (!hasNumber(selectedLat) || !hasNumber(selectedLng)) {
        setSelectedLat(lat);
        setSelectedLng(lng);
      }
    };

    (async () => {
      try {
        // 1) If parent provided initial coords, use them immediately
        if (hasNumber(initialLat) && hasNumber(initialLng)) {
          setFromLatLng(initialLat, initialLng);
          return;
        }

        // 2) Otherwise, request permission if needed, then get a location
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== "granted") return;
        }

        // Fast path first (prevents delays on many devices)
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          setFromLatLng(last.coords.latitude, last.coords.longitude);
          return;
        }

        // Fallback
        const cur = await Location.getCurrentPositionAsync({});
        setFromLatLng(cur.coords.latitude, cur.coords.longitude);
      } catch {
        // If anything fails, we keep the placeholder (no Israel flash).
        // You can add an error UI if you want.
        console.log("Could not get location for map center");
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialLat, initialLng]);

  const handleMapPress = (e: any) => {
    const g = e?.geometry;
    if (!g || g.type !== "Point") return;

    const [lng, lat] = g.coordinates;
    setSelectedLat(lat);
    setSelectedLng(lng);
  };

  const handleConfirm = () => {
    if (selectedLat !== undefined && selectedLng !== undefined) {
      onConfirm(selectedLat, selectedLng);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text variant="titleLarge">Choose Location on Map</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {mapCenter && mapZoom !== null ? (
            <MapboxGL.MapView
              style={styles.map}
              styleURL={MapboxGL.StyleURL.Light}
              onPress={handleMapPress}
              compassEnabled={false}
              scaleBarEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
            >
              <MapboxGL.Camera
                zoomLevel={mapZoom}
                centerCoordinate={mapCenter}
                animationDuration={0}
              />

              {/* 1. BASE LAYER */}
              <MapboxGL.RasterSource
                id="israel-hiking-base-modal"
                tileUrlTemplates={[baseTiles]}
                tileSize={256}
              >
                <MapboxGL.RasterLayer
                  id="hiking-base-modal-layer"
                  sourceID="israel-hiking-base-modal"
                />
              </MapboxGL.RasterSource>

              {/* 2. TRAILS LAYER - only for hiking style */}
              {config.mapStyle === 'hiking' && (
                <MapboxGL.RasterSource
                  id="israel-trails-modal"
                  tileUrlTemplates={[trailTiles]}
                  tileSize={256}
                  maxZoomLevel={18}
                  minZoomLevel={7}
                >
                  <MapboxGL.RasterLayer
                    id="trails-modal-layer"
                    sourceID="israel-trails-modal"
                    style={{ rasterOpacity: 1.0 }}
                  />
                </MapboxGL.RasterSource>
              )}

              {/* User Location */}
              <MapboxGL.UserLocation visible={true} showsUserHeadingIndicator={true} />

              {/* Selected Pin */}
              {selectedLat !== undefined && selectedLng !== undefined && (
                <MapboxGL.ShapeSource
                  id="selected-marker-source"
                  shape={{
                    type: "FeatureCollection",
                    features: [
                      {
                        type: "Feature",
                        geometry: {
                          type: "Point",
                          coordinates: [selectedLng, selectedLat],
                        },
                        properties: { id: "selected" },
                      },
                    ],
                  }}
                >
                  <MapboxGL.CircleLayer
                    id="selected-marker-layer"
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
          ) : (
            // Placeholder while we resolve location (prevents the Israel zoom-out flash)
            <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
          )}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
          <Text style={{ opacity: 0.7, textAlign: "center", marginBottom: 12 }}>
            Tap anywhere on the map to set meeting location
          </Text>
          <Button
            mode="contained"
            onPress={handleConfirm}
            disabled={selectedLat === undefined || selectedLng === undefined}
            contentStyle={{ paddingVertical: 8 }}
          >
            Confirm Location
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: 16,
    paddingBottom: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
