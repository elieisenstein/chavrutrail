import React from "react";
import { View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { CreateRideDraft } from "../createRideTypes";

export default function StepWhen({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const theme = useTheme();
  const selected = draft.start_at ? new Date(draft.start_at) : null;

  function setStart(date: Date) {
    onChange({ start_at: date.toISOString() });
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.colors.onBackground }}>
        Choose a start time (MVP buttons for now).
      </Text>

      <Button mode="outlined" onPress={() => setStart(new Date(Date.now() + 60 * 60 * 1000))}>
        In 1 hour
      </Button>

      <Button
        mode="outlined"
        onPress={() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(7, 30, 0, 0);
          setStart(d);
        }}
      >
        Tomorrow 07:30
      </Button>

      <Text style={{ color: theme.colors.onBackground, opacity: 0.7 }}>
        Selected: {selected ? selected.toLocaleString() : "Not set"}
      </Text>
    </View>
  );
}
