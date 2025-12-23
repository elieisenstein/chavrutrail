import React from "react";
import { View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { CreateRideDraft, JoinMode } from "../createRideTypes";

const joinModes: { mode: JoinMode; label: string }[] = [
  { mode: "express", label: "Express (auto-join)" },
  { mode: "approval", label: "Approval (owner accepts)" },
];

export default function StepGroup({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text>Join mode</Text>
      <View style={{ gap: 8 }}>
        {joinModes.map((jm) => (
          <Button
            key={jm.mode}
            mode={draft.join_mode === jm.mode ? "contained" : "outlined"}
            onPress={() => onChange({ join_mode: jm.mode })}
          >
            {jm.label}
          </Button>
        ))}
      </View>

      <TextInput
        label="Max participants (1–6)"
        value={draft.max_participants?.toString() ?? "4"}
        onChangeText={(v) => onChange({ max_participants: v === "" ? undefined : Number(v) })}
        keyboardType="numeric"
      />

      <Text style={{ opacity: 0.7 }}>
        Recommendation: keep it small (4) for easier matching.
      </Text>
    </View>
  );
}
