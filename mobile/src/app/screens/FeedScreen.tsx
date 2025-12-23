import React from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";

export default function FeedScreen() {
  return (
    <View style={{ padding: 16, marginTop: 24 }}>
      <Text variant="headlineSmall">Feed</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>
        Placeholder. Next: ride cards + filters bottom sheet.
      </Text>
    </View>
  );
}
