import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { CreateRideDraft } from "../createRideTypes";
import { formatDateTimeLocal } from "../../../../lib/datetime";

export default function StepReview({ draft }: { draft: CreateRideDraft }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="titleMedium">Summary</Text>

      <Text>When: {draft.start_at ? formatDateTimeLocal(draft.start_at) : "—"}</Text>
      <Text>
        Where:{" "}
        {typeof draft.start_lat === "number" && typeof draft.start_lng === "number"
          ? `${draft.start_lat.toFixed(5)}, ${draft.start_lng.toFixed(5)}`
          : "—"}
      </Text>

      <Text>Type: {draft.ride_type ?? "—"}</Text>
      <Text>Skill: {draft.skill_level ?? "—"}</Text>
      <Text>Distance: {draft.distance_km ?? "—"} km</Text>
      <Text>Elevation: {draft.elevation_m ?? "—"} m</Text>

      <Text>Join mode: {draft.join_mode ?? "—"}</Text>
      <Text>Max: {draft.max_participants ?? "—"}</Text>
    </View>
  );
}
