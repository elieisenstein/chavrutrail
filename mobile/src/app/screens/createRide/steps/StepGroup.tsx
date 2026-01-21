import React from "react";
import { View } from "react-native";
import { Button, Text, IconButton, Chip, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CreateRideDraft, JoinMode } from "../createRideTypes";

const joinModes: { mode: JoinMode }[] = [
  { mode: "express" },
  { mode: "approval" },
];

const genderPreferences: Array<"all" | "men" | "women"> = ["all", "men", "women"];

export default function StepGroup({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: 12 }}>
      <Text>{t("createRide.group.joinMode")}</Text>
      <View style={{ gap: 8 }}>
        {joinModes.map((jm) => (
          <Button
            key={jm.mode}
            mode={draft.join_mode === jm.mode ? "contained" : "outlined"}
            onPress={() => onChange({ join_mode: jm.mode })}
          >
            {t(`createRide.group.joinModes.${jm.mode}`)}
          </Button>
        ))}
      </View>

      <Text>{t("createRide.group.maxParticipants")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton
          icon="minus"
          mode="contained"
          disabled={(draft.max_participants ?? 4) <= 2}
          onPress={() => onChange({ max_participants: (draft.max_participants ?? 4) - 1 })}
        />
        <Text variant="headlineMedium" style={{ minWidth: 32, textAlign: "center" }}>
          {draft.max_participants ?? 4}
        </Text>
        <IconButton
          icon="plus"
          mode="contained"
          disabled={(draft.max_participants ?? 4) >= 6}
          onPress={() => onChange({ max_participants: (draft.max_participants ?? 4) + 1 })}
        />
      </View>

      <Text style={{ opacity: 0.7 }}>
        {t("createRide.group.recommendation")}
      </Text>

      <Text style={{ marginTop: 12 }}>{t("createRide.group.genderPreference")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {genderPreferences.map((pref) => (
          <Chip
            key={pref}
            selected={draft.gender_preference === pref}
            onPress={() => onChange({ gender_preference: pref })}
            mode={draft.gender_preference === pref ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: draft.gender_preference === pref ? theme.colors.primary : "transparent",
            }}
            textStyle={{
              color: draft.gender_preference === pref ? theme.colors.onPrimary : theme.colors.onSurface,
            }}
          >
            {t(`createRide.group.genderOptions.${pref}`)}
          </Chip>
        ))}
      </View>


    </View>
  );
}
