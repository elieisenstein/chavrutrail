import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Button, Text } from "react-native-paper";

import { CreateRideDraft } from "../createRideTypes";

const ISRAEL_REGION: Region = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function StepWhere({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const [region, setRegion] = useState<Region>(ISRAEL_REGION);

  useEffect(() => {
    if (
      typeof draft.start_lat === "number" &&
      typeof draft.start_lng === "number"
    ) {
      setRegion((r) => ({
        ...r,
        latitude: draft.start_lat!,
        longitude: draft.start_lng!,
      }));
    }
  }, [draft.start_lat, draft.start_lng]);

  function onMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onChange({
      start_lat: latitude,
      start_lng: longitude,
      start_name: null,
    });
  }

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Location permission denied");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    onChange({
      start_lat: loc.coords.latitude,
      start_lng: loc.coords.longitude,
      start_name: null,
    });

    setRegion((r) => ({
      ...r,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    }));
  }

  const hasPin =
    typeof draft.start_lat === "number" &&
    typeof draft.start_lng === "number";

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ marginBottom: 8 }}>
        Tap on the map to choose a start point
      </Text>

      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          region={region}
          onPress={onMapPress}
        >
          {hasPin && (
            <Marker
              coordinate={{
                latitude: draft.start_lat!,
                longitude: draft.start_lng!,
              }}
            />
          )}
        </MapView>
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        <Button mode="outlined" onPress={useMyLocation}>
          Use my location
        </Button>

        <Text style={{ opacity: 0.7 }}>
          {hasPin
            ? `Selected: ${draft.start_lat!.toFixed(
                5
              )}, ${draft.start_lng!.toFixed(5)}`
            : "No location selected"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
});
