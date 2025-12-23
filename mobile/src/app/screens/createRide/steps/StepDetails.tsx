import React from "react";
import { View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { CreateRideDraft, RideType, SkillLevel } from "../createRideTypes";

const rideTypes: RideType[] = ["XC", "Trail", "Enduro", "Gravel"];
const skillLevels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced"];

export default function StepDetails({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text>Ride type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {rideTypes.map((rt) => (
          <Button key={rt} mode={draft.ride_type === rt ? "contained" : "outlined"} onPress={() => onChange({ ride_type: rt })}>
            {rt}
          </Button>
        ))}
      </View>

      <Text>Skill level</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {skillLevels.map((sl) => (
          <Button key={sl} mode={draft.skill_level === sl ? "contained" : "outlined"} onPress={() => onChange({ skill_level: sl })}>
            {sl}
          </Button>
        ))}
      </View>

      <TextInput
        label="Distance (km) — optional"
        value={draft.distance_km?.toString() ?? ""}
        onChangeText={(v) => onChange({ distance_km: v === "" ? null : Number(v) })}
        keyboardType="numeric"
      />

      <TextInput
        label="Elevation (m) — optional"
        value={draft.elevation_m?.toString() ?? ""}
        onChangeText={(v) => onChange({ elevation_m: v === "" ? null : Number(v) })}
        keyboardType="numeric"
      />
    </View>
  );
}
