import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, useTheme, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { CreateRideDraft } from "../createRideTypes";
import MapPickerModal from "../../../../components/MapPickerModal";

export default function StepWhere({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  async function useCurrentLocation() {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      onChange({
        start_lng: location.coords.longitude,
        start_lat: location.coords.latitude,
      });
    } catch (error) {
      alert('Failed to get location. Please try again.');
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleMapConfirm(lat: number, lng: number) {
    onChange({
      start_lat: lat,
      start_lng: lng,
    });
  }

  return (
    <View style={{ gap: 16 }}>
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        {t("createRide.where.title")}
      </Text>

      {/* Meeting Point Text Input */}
      <TextInput
        label={t("createRide.where.meetingPointLabel")}
        placeholder={t("createRide.where.meetingPointPlaceholder")}
        value={draft.start_name || ""}
        onChangeText={(text) => onChange({ start_name: text })}
        mode="outlined"
        style={{ backgroundColor: theme.colors.surface }}
      />

      <Text style={{ opacity: 0.7, fontSize: 12, marginTop: -8 }}>
        {t("createRide.where.meetingPointHelp")}
      </Text>

      {/* Route Description */}
      <TextInput
        label={t("createRide.where.routeLabel")}
        placeholder={t("createRide.where.routePlaceholder")}
        value={draft.notes || ""}
        onChangeText={(text) => onChange({ notes: text })}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={{ backgroundColor: theme.colors.surface }}
      />

      <Text style={{ opacity: 0.7, fontSize: 12, marginTop: -8 }}>
        {t("createRide.where.routeHelp")}
      </Text>

      {/* Location Selection Section */}
      <Text variant="titleSmall" style={{ color: theme.colors.onBackground, marginTop: 16 }}>
        {t("createRide.where.meetingPointLabel")}
      </Text>
      
      <Text style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {t("createRide.where.locationInstruction")}
      </Text>

      <Button
        mode="contained"
        icon="crosshairs-gps"
        onPress={useCurrentLocation}
        loading={loadingLocation}
        disabled={loadingLocation}
        contentStyle={{ paddingVertical: 4 }}
      >
        🎯 Use Current Location
      </Button>

      <Button
        mode="outlined"
        icon="map-marker"
        onPress={() => setMapModalVisible(true)}
        contentStyle={{ paddingVertical: 4 }}
      >
        📍 Choose on Map
      </Button>

      {/* Map Picker Modal */}
      <MapPickerModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onConfirm={handleMapConfirm}
        initialLat={draft.start_lat}
        initialLng={draft.start_lng}
      />
    </View>
  );
}
