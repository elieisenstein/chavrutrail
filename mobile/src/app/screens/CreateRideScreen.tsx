import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";

export default function CreateRideScreen() {
  return (
    <View style={{ padding: 16, marginTop: 24 }}>
      <Text variant="headlineSmall">Create</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>
        Placeholder. Next: short wizard (type → location/time → distance/difficulty → publish).
      </Text>
    </View>
  );
}
