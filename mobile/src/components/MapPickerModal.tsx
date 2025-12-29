// src/components/MapPickerModal.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { Button, Text, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { getIsraelHikingTiles } from '../lib/mapbox';

type MapPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
};

export default function MapPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: MapPickerModalProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const { baseTiles, trailTiles } = getIsraelHikingTiles(
    i18n.language === 'he' ? 'he' : 'en'
  );

  const [selectedLat, setSelectedLat] = useState<number | undefined>(initialLat);
  const [selectedLng, setSelectedLng] = useState<number | undefined>(initialLng);
  const [mapCenter, setMapCenter] = useState<[number, number]>([34.75, 31.5]); // Israel center
  const [mapZoom, setMapZoom] = useState(8);

  // Get user location for initial map center
  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            setMapCenter([location.coords.longitude, location.coords.latitude]);
            setMapZoom(12);
            
            // If no initial location, use current location as starting point
            if (!initialLat && !initialLng) {
              setSelectedLat(location.coords.latitude);
              setSelectedLng(location.coords.longitude);
            }
          }
        } catch (error) {
          console.log('Could not get location for map center');
        }
      })();
    }
  }, [visible, initialLat, initialLng]);

  const handleMapPress = (e: any) => {
    const g = e.geometry;
    if (!g || g.type !== 'Point') return;
    
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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text variant="titleLarge">Choose Location on Map</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
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

            {/* 1. BASE LAYER: The actual topographic map background */}
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

            {/* 2. TRAILS LAYER: The hiking/MTB trail overlays */}
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

            {/* User Location */}
            <MapboxGL.UserLocation
              visible={true}
              showsUserHeadingIndicator={true}
            />

            {/* Selected Pin - Using ShapeSource for reliable rendering */}
            {selectedLat !== undefined && selectedLng !== undefined && (
              <MapboxGL.ShapeSource
                id="selected-marker-source"
                shape={{
                  type: "FeatureCollection",
                  features: [{
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [selectedLng, selectedLat] },
                    properties: { id: "selected" },
                  }],
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
        </View>

        {/* Confirm Button - Fixed at bottom with safe area */}
        <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
          <Text style={{ opacity: 0.7, textAlign: 'center', marginBottom: 12 }}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
