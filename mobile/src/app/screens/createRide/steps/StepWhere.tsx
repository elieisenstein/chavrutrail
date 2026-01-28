import React, { useState } from "react";
import { View, Alert, ScrollView } from "react-native";
import { Text, TextInput, useTheme, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import { CreateRideDraft } from "../createRideTypes";
import MapPickerModal from "../../../../components/MapPickerModal";
import { isValidGpx, parseGpxCoordinates, MAX_GPX_FILE_SIZE } from "../../../../lib/gpx";

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
  const [pickingGpx, setPickingGpx] = useState(false);

  async function handlePickGpx() {
    setPickingGpx(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/gpx+xml", "text/xml", "application/xml", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (file.size && file.size > MAX_GPX_FILE_SIZE) {
        Alert.alert(t("common.error"), t("createRide.where.gpxTooLarge"));
        return;
      }

      const content = await fetch(file.uri).then((r) => r.text());
      if (!isValidGpx(content)) {
        Alert.alert(t("common.error"), t("createRide.where.gpxInvalid"));
        return;
      }

      const coords = parseGpxCoordinates(content);
      if (coords.length < 2) {
        Alert.alert(t("common.error"), t("createRide.where.gpxNoPoints"));
        return;
      }

      onChange({
        gpx_file_uri: file.uri,
        gpx_file_name: file.name,
        gpx_coordinates: coords,
      });
    } catch {
      Alert.alert(t("common.error"), t("createRide.where.gpxInvalid"));
    } finally {
      setPickingGpx(false);
    }
  }

  function handleRemoveGpx() {
    onChange({
      gpx_file_uri: null,
      gpx_file_name: null,
      gpx_coordinates: null,
    });
  }

  async function useCurrentLocation() {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t("common.error"), t("createRide.where.locationDenied"));
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      onChange({
        start_lng: location.coords.longitude,
        start_lat: location.coords.latitude,
      });
    } catch (error) {
      Alert.alert(t("common.error"), t("createRide.where.locationFailed"));
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16 }}>
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

      {/* GPX Upload */}
      {draft.gpx_file_name ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: theme.colors.onBackground }}>
            {t("createRide.where.gpxAttached", {
              name: draft.gpx_file_name,
              points: draft.gpx_coordinates?.length ?? 0,
            })}
          </Text>
          <Button
            mode="text"
            icon="close"
            onPress={handleRemoveGpx}
            compact
          >
            {t("createRide.where.gpxRemove")}
          </Button>
        </View>
      ) : (
        <Button
          mode="outlined"
          icon="file-upload"
          onPress={handlePickGpx}
          loading={pickingGpx}
          disabled={pickingGpx}
          textColor={theme.colors.primary}
          style={{ borderColor: theme.colors.primary }}
          contentStyle={{ paddingVertical: 6 }}
        >
          {t("createRide.where.gpxAttach")}
        </Button>
      )}

      {/* Location Selection Section */}
      <Text variant="titleSmall" style={{ color: theme.colors.onBackground, marginTop: 8 }}>
        {t("createRide.where.meetingPointLabel")}
      </Text>

      <Text style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {t("createRide.where.locationInstruction")}
      </Text>

      <View style={{ flexDirection: "row" }}>
        <Button
          mode="contained"
          icon="map-marker"
          onPress={() => setMapModalVisible(true)}
          style={{ flex: 1 }}
          buttonColor={theme.colors.primary}     // orange (if your theme primary is orange)
          textColor={theme.colors.onPrimary}
          contentStyle={{ paddingVertical: 6 }}
        >
          {t("createRide.where.chooseOnMap")}
        </Button>
      </View>


      {/* Map Picker Modal */}
      <MapPickerModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onConfirm={handleMapConfirm}
        initialLat={draft.start_lat}
        initialLng={draft.start_lng}
      />
    </ScrollView>
  );
}
