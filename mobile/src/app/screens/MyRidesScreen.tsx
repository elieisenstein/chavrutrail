// src/app/screens/MyRidesScreen.tsx
import React, { useState, useCallback } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Card, Text, useTheme, SegmentedButtons, ActivityIndicator } from "react-native-paper";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import type { Ride } from "../../lib/rides";
import { getMyOrganizingRides, getMyJoinedRides, getMyRequestedRides } from "../../lib/rides";
import type { MyRidesStackParamList } from "../navigation/AppNavigator";

type Section = "organizing" | "joined" | "requested";
type MyRideStatus = "owner" | "joined" | "requested";

export default function MyRidesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MyRidesStackParamList>>();
  const { t } = useTranslation();

  const [selectedSection, setSelectedSection] = useState<Section>("organizing");
  const [organizingRides, setOrganizingRides] = useState<Ride[]>([]);
  const [joinedRides, setJoinedRides] = useState<Ride[]>([]);
  const [requestedRides, setRequestedRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRides = useCallback(async () => {
    setLoading(true);
    try {
      const [organizing, joined, requested] = await Promise.all([
        getMyOrganizingRides(),
        getMyJoinedRides(),
        getMyRequestedRides(),
      ]);
      setOrganizingRides(organizing);
      setJoinedRides(joined);
      setRequestedRides(requested);
    } catch (e: any) {
      console.log("Load my rides error:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load rides when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [loadRides])
  );

  const getCurrentRides = (): Ride[] => {
    switch (selectedSection) {
      case "organizing":
        return organizingRides;
      case "joined":
        return joinedRides;
      case "requested":
        return requestedRides;
    }
  };

  const getCurrentStatus = (): MyRideStatus => {
    switch (selectedSection) {
      case "organizing":
        return "owner";
      case "joined":
        return "joined";
      case "requested":
        return "requested";
    }
  };

  const getStatusColor = (status: MyRideStatus): string => {
    switch (status) {
      case "owner":
        return "#FF6B35";
      case "joined":
        return "#4CAF50";
      case "requested":
        return "#FFC107";
    }
  };

  const getStatusLabel = (status: MyRideStatus): string => {
    switch (status) {
      case "owner":
        return t("myRides.statusLabels.owner");
      case "joined":
        return t("myRides.statusLabels.joined");
      case "requested":
        return t("myRides.statusLabels.requested");
    }
  };

  function renderRide({ item: ride }: { item: Ride }) {
    const status = getCurrentStatus();
    const statusColor = getStatusColor(status);
    const statusLabel = getStatusLabel(status);

    return (
      <Card
        style={[
          styles.card,
          {
            borderLeftWidth: 4,
            borderLeftColor: statusColor,
          }
        ]}
        onPress={() => navigation.navigate("RideDetails", { rideId: ride.id })}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
              {t(`rideTypes.${ride.ride_type}`)} · {t(`skillLevels.${ride.skill_level}`)}
            </Text>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
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
      case "organizing":
        return t("myRides.emptyStates.organizing");
      case "joined":
        return t("myRides.emptyStates.joined");
      case "requested":
        return t("myRides.emptyStates.requested");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* Section Selector */}
      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={selectedSection}
          onValueChange={(value) => setSelectedSection(value as Section)}
          buttons={[
            {
              value: "organizing",
              label: t("myRides.organizing"),
            },
            {
              value: "joined",
              label: t("myRides.joined"),
            },
            {
              value: "requested",
              label: t("myRides.requested"),
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