import React from "react";
import { ScrollView } from "react-native";
import { Text, Divider, useTheme } from "react-native-paper";
import { CreateRideDraft } from "../createRideTypes";
import { formatDateTimeLocal } from "../../../../lib/datetime";
import IsraelHikingMapView from "../../../../components/IsraelHikingMapView";

export default function StepReview({ draft }: { draft: CreateRideDraft }) {
  const theme = useTheme();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        Review your ride details
      </Text>

      <Divider />

      {/* When */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>When: </Text>
        {draft.start_at ? formatDateTimeLocal(draft.start_at) : "-"}
      </Text>

      {/* Where */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>Where: </Text>
        {draft.start_name || "-"}
      </Text>

      {/* Route Description */}
      {draft.notes && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>Route: </Text>
          {draft.notes}
        </Text>
      )}

      {/* Meeting Location Map */}
      {draft.start_lat !== undefined && draft.start_lng !== undefined && (
        <>
          <Text style={{ color: theme.colors.onBackground, fontWeight: "bold", marginTop: 8 }}>
            Meeting Location:
          </Text>
          <IsraelHikingMapView
            center={[draft.start_lng, draft.start_lat]}
            zoom={14}
            height={200}
            interactive={false}
            markers={[{ coordinate: [draft.start_lng, draft.start_lat], id: 'meeting' }]}
          />
        </>
      )}

      <Divider style={{ marginTop: 12 }} />

      {/* Details */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>Type: </Text>
        {draft.ride_type || "-"}
      </Text>

      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>Skill: </Text>
        {draft.skill_level || "-"}
      </Text>

      {draft.pace && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>Pace: </Text>
          {draft.pace}
        </Text>
      )}

      {draft.distance_km != null && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>Distance: </Text>
          {draft.distance_km} km
        </Text>
      )}

      {draft.elevation_m != null && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>Elevation: </Text>
          {draft.elevation_m} m
        </Text>
      )}

      {/* Group */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>Group mode: </Text>
        {draft.join_mode === "express" ? "Express (auto-join)" : "Approval required"}
      </Text>

      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>Max participants: </Text>
        {draft.max_participants || "-"}
      </Text>

      <Divider />

      <Text style={{ opacity: 0.7, fontStyle: "italic" }}>
        Tap "Publish" to create your ride!
      </Text>
    </ScrollView>
  );
}
