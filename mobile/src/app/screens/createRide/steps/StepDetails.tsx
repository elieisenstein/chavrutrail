import React from "react";
import { View } from "react-native";
import { Button, Text, TextInput, Chip, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CreateRideDraft, RideType, SkillLevel } from "../createRideTypes";

//const rideTypes: RideType[] = ["XC", "Trail", "Enduro", "Gravel", "Road"];
const rideTypes: RideType[] = ["Trail", "Enduro", "Gravel", "Road"];
const skillLevels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced"];
const paceOptions = ["Slow", "Moderate", "Fast"];

export default function StepDetails({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: 16 }}>
      <Text>{t("createRide.details.rideType")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {rideTypes.map((rt) => (
          <Chip
            key={rt}
            selected={draft.ride_type === rt}
            onPress={() => onChange({ ride_type: rt })}
            mode={draft.ride_type === rt ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: draft.ride_type === rt ? theme.colors.primary : "transparent",
            }}
            textStyle={{
              color: draft.ride_type === rt ? theme.colors.onPrimary : theme.colors.onSurface,
            }}
          >
            {t(`rideTypes.${rt}`)}
          </Chip>
        ))}
      </View>

      <Text>{t("createRide.details.skillLevel")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {skillLevels.map((sl) => (
          <Chip
            key={sl}
            selected={draft.skill_level === sl}
            onPress={() => onChange({ skill_level: sl })}
            mode={draft.skill_level === sl ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: draft.skill_level === sl ? theme.colors.primary : "transparent",
            }}
            textStyle={{
              color: draft.skill_level === sl ? theme.colors.onPrimary : theme.colors.onSurface,
            }}
          >
            {t(`skillLevels.${sl}`)}
          </Chip>
        ))}
      </View>


      <Text>{t("profile.pace")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {paceOptions.map((pace) => (
          <Chip
            key={pace}
            selected={draft.pace === pace}
            onPress={() => onChange({ pace: pace as "Slow" | "Moderate" | "Fast" })}
            mode={draft.pace === pace ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: draft.pace === pace ? theme.colors.primary : "transparent",
            }}
            textStyle={{
              color: draft.pace === pace ? theme.colors.onPrimary : theme.colors.onSurface,
            }}
          >
            {t(`paceOptions.${pace}`)}
          </Chip>
        ))}
      </View>

      <TextInput
        label={t("createRide.details.distance")}
        value={draft.distance_km?.toString() ?? ""}
        onChangeText={(v) => onChange({ distance_km: v === "" ? null : Number(v) })}
        keyboardType="numeric"
        style={{ marginTop: 16 }}
      />

      <TextInput
        label={t("createRide.details.elevation")}
        value={draft.elevation_m?.toString() ?? ""}
        onChangeText={(v) => onChange({ elevation_m: v === "" ? null : Number(v) })}
        keyboardType="numeric"
      />
    </View>
  );
}