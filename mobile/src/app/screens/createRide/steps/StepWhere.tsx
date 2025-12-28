import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { Text, TextInput, useTheme, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { CreateRideDraft } from "../createRideTypes";
import IsraelHikingMapView from "../../../../components/IsraelHikingMapView";

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
  const [mapCenter, setMapCenter] = useState<[number, number]>([34.75, 31.5]); // Default: Israel center [lng, lat]
  const [mapZoom, setMapZoom] = useState(8);

  // Try to get user location for map center on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setMapCenter([location.coords.longitude, location.coords.latitude]);
          setMapZoom(12);
        }
      } catch (error) {
        // Silently fail - map will show Israel center
      }
    })();
  }, []);

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
        start_lat: location.coords.latitude,
        start_lng: location.coords.longitude,
        start_name: draft.start_name || `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
      });
    } catch (error) {
      alert('Failed to get location. Please try again.');
    } finally {
      setLoadingLocation(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        {t("createRide.where.title")}
      </Text>

      {/* Meeting Point */}
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

      {/* Use Current Location Button */}
      <Button
        mode="contained"
        icon="crosshairs-gps"
        onPress={useCurrentLocation}
        loading={loadingLocation}
        disabled={loadingLocation}
        style={{ marginTop: 8 }}
      >
        Use Current Location
      </Button>

      {draft.start_lat && draft.start_lng && (
        <Text style={{ opacity: 0.6, fontSize: 12, textAlign: 'center' }}>
          📍 {draft.start_lat.toFixed(4)}, {draft.start_lng.toFixed(4)}
        </Text>
      )}

      {/* Optional Route Description */}
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

      {/* Map - Tap to Select Meeting Location */}
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground, marginTop: 16 }}>
        📍 Meeting Location (Required)
      </Text>
      <Text style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        Tap on the map where riders should meet
      </Text>

      <IsraelHikingMapView
        center={mapCenter}
        zoom={mapZoom}
        height={300}
        interactive={true}
        showUserLocation={true}
        markers={
          draft.start_lat !== undefined && draft.start_lng !== undefined
            ? [{ coordinate: [draft.start_lng, draft.start_lat], id: 'meeting-point' }]
            : []
        }
        onMapPress={(coords) => {
          const [lng, lat] = coords;
          onChange({
            start_lng: lng,
            start_lat: lat,
          });
        }}
      />

      {(() => {
        const lat = draft.start_lat;
        const lng = draft.start_lng;
        return lat !== undefined && lng !== undefined ? (
          <Text style={{ opacity: 0.6, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            Selected: {lat.toFixed(4)}, {lng.toFixed(4)}
          </Text>
        ) : null;
      })()}

      {/* Summary Display */}
      {draft.start_name && (
        <View 
          style={{ 
            padding: 16, 
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 8,
            marginTop: 8
          }}
        >
          <Text style={{ opacity: 0.7, fontSize: 12 }}>
            {t("createRide.where.summaryMeeting")}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
            {draft.start_name}
          </Text>
          {draft.notes && (
            <>
              <Text style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
                {t("createRide.where.summaryRoute")}
              </Text>
              <Text style={{ color: theme.colors.onBackground }}>
                {draft.notes}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}