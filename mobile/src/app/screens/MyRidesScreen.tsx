// src/app/screens/MyRidesScreen.tsx
import React, { useState, useCallback } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Card, Text, useTheme, SegmentedButtons, ActivityIndicator } from "react-native-paper";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import type { Ride } from "../../lib/rides";
import { getActiveMyRidesWithCache, getMyRideHistoryWithCache } from "../../lib/rides";
import type { MyRidesStackParamList } from "../navigation/AppNavigator";
import { supabase } from "../../lib/supabase";
import { Chip } from "react-native-paper";
import { StalenessIndicator } from "../../components/StalenessIndicator";

type Section = "active" | "history";

export default function MyRidesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MyRidesStackParamList>>();
  const { t } = useTranslation();

  const [selectedSection, setSelectedSection] = useState<Section>("active");
  const [activeRides, setActiveRides] = useState<Ride[]>([]);
  const [historyRides, setHistoryRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);

  // Offline cache state
  const [fromCache, setFromCache] = useState(false);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | undefined>();

  const loadRides = useCallback(async () => {
    setLoading(true);
    try {
      const [activeResult, historyResult] = await Promise.all([
        getActiveMyRidesWithCache(),
        getMyRideHistoryWithCache(),
      ]);
      setActiveRides(activeResult.data);
      setHistoryRides(historyResult.data);
      // Show cache indicator if either result is from cache
      const isFromCache = activeResult.fromCache || historyResult.fromCache;
      setFromCache(isFromCache);
      // Use the older cache age if both are cached
      if (isFromCache) {
        const activeAge = activeResult.cacheAgeMinutes ?? 0;
        const historyAge = historyResult.cacheAgeMinutes ?? 0;
        setCacheAgeMinutes(Math.max(activeAge, historyAge));
      } else {
        setCacheAgeMinutes(undefined);
      }
    } catch (e: any) {
      console.log("Load my rides error:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load rides when screen comes into focus AND set up real-time subscription
  useFocusEffect(
    useCallback(() => {
      loadRides();

      // Subscribe to changes in ride_participants table for current user
      const channel = supabase
        .channel('my_rides_updates')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'ride_participants',
          },
          (payload) => {
            console.log('🔄 My rides participant change:', payload);
            // Reload all rides when any participant change happens
            loadRides();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for ride updates (cancellation, edits, etc)
            schema: 'public',
            table: 'rides',
          },
          (payload) => {
            console.log('🔄 My rides ride change:', payload);
            // Reload rides when a ride is updated or cancelled
            loadRides();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [loadRides])
  );

  const getCurrentRides = (): Ride[] => {
    switch (selectedSection) {
      case "active":
        return activeRides;
      case "history":
        return historyRides;
    }
  };

  const getStatusForRide = (ride: Ride): { color: string; label: string } => {
    if (ride._myRole === "owner") {
      return { color: "#FF6B35", label: t("myRides.statusLabels.owner") };
    } else if (ride._participantStatus === "requested") {
      return { color: "#FFC107", label: t("myRides.statusLabels.requested") };
    } else {
      return { color: "#4CAF50", label: t("myRides.statusLabels.joined") };
    }
  };

  function renderRide({ item: ride }: { item: Ride }) {
    const { color, label } = getStatusForRide(ride);

    return (
      <Card
        style={[
          styles.card,
          {
            borderLeftWidth: 4,
            borderLeftColor: color,
          }
        ]}
        onPress={() => navigation.navigate("RideDetails", { rideId: ride.id })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
              {t(`rideTypes.${ride.ride_type}`)} · {t(`skillLevels.${ride.skill_level}`)}
            </Text>
            <Chip
              mode="flat"
              style={{ backgroundColor: color }}
              textStyle={{ color: "#FFF", fontWeight: "bold" }}
            >
              {label}
            </Chip>
          </View>

          {ride.pace && (
            <Text style={{ opacity: 0.8, marginTop: 4 }}>
              {t("profile.pace")}: {t(`paceOptions.${ride.pace}`)}
            </Text>
          )}

          <Text style={{ opacity: 0.8, marginTop: 4 }}>
            {t("rideDetails.when")}: {(() => {
              const startDate = new Date(ride.start_at);
              const endDate = new Date(startDate);
              endDate.setHours(endDate.getHours() + ride.duration_hours);

              const dateStr = startDate.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
              const startTime = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
              const endTime = endDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

              return `${dateStr} ${startTime}-${endTime} (${ride.duration_hours}h)`;
            })()}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.where")}: {ride.start_name || `${ride.start_lat.toFixed(4)}, ${ride.start_lng.toFixed(4)}`}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.group")}: {t(`rideDetails.joinModes.${ride.join_mode.toLowerCase()}`)} · {t("rideDetails.max")} {ride.max_participants}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("createRide.group.genderPreference")}: {t(`createRide.group.genderOptions.${ride.gender_preference}`)}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const rides = getCurrentRides();

  function getEmptyMessage(): string {
    switch (selectedSection) {
      case "active":
        return t("myRides.emptyStates.active");
      case "history":
        return t("myRides.emptyStates.history");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Offline Indicator */}
      {fromCache && cacheAgeMinutes !== undefined && (
        <StalenessIndicator cacheAgeMinutes={cacheAgeMinutes} onRefresh={loadRides} />
      )}

      {/* Section Selector */}
      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={selectedSection}
          onValueChange={(value) => setSelectedSection(value as Section)}
          buttons={[
            {
              value: "active",
              label: t("myRides.tabs.active"),
              icon: "clock-outline",
            },
            {
              value: "history",
              label: t("myRides.tabs.history"),
              icon: "history",
            },
          ]}
        />
      </View>

      {/* Rides List */}
      {loading && rides.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ opacity: 0.6, textAlign: "center" }}>
            {getEmptyMessage()}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRide}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRides} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    paddingTop: 24,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});