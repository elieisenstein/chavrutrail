import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { listPublishedUpcomingRides, Ride } from "../../lib/rides";
import { formatDateTimeLocal } from "../../lib/datetime";
import type { FeedStackParamList } from "../navigation/AppNavigator";

export default function FeedScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigation = useNavigation<NativeStackNavigationProp<FeedStackParamList>>();
  const theme = useTheme();


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPublishedUpcomingRides(50);
      setRides(data);
    } catch (e: any) {
      console.log("Feed load error:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  
  useFocusEffect(
    useCallback(() => {
      load();
      // no cleanup needed
      return () => {};
    }, [load])
  );

  return (
  <ScrollView
    style={{ flex: 1, backgroundColor: theme.colors.background }}
    contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
  >
 

  <Text style={{ marginBottom: 8, color: theme.colors.onBackground, opacity: 0.7 }}>
    Drag down to refresh · Upcoming rides
  </Text>

    <View style={{ marginTop: 12, gap: 12 }}>
      {/* ...rest unchanged... */}
    </View>
  </ScrollView>
);
}
