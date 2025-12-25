import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Card, Text, useTheme, Button, Portal, Modal, Checkbox, Divider } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { listFilteredRides, Ride, type RideFilters } from "../../lib/rides";
import { formatDateTimeLocal } from "../../lib/datetime";
import type { FeedStackParamList } from "../navigation/AppNavigator";

// Available options
const RIDE_TYPES = ["XC", "Trail", "Enduro", "Gravel"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DAY_OPTIONS = [1, 3, 7, 14, 30];

export default function FeedScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<FeedStackParamList>>();
  const theme = useTheme();

  // Current active filters
  const [filters, setFilters] = useState<RideFilters>({
    rideTypes: [], // Empty = all types
    skillLevels: [], // Empty = all skills (will store 0 or 1 item after update)
    maxDays: 7,
    // No location filter by default
  });

  // Draft filters (for editing in modal before applying)
  const [draftFilters, setDraftFilters] = useState<RideFilters>(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFilteredRides(filters, 50);
      setRides(data);
    } catch (e: any) {
      console.log("Feed load error:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load])
  );

  // Build filter summary text
  function getFilterSummary(): string {
    const parts: string[] = [];

    // Ride types
    if (filters.rideTypes.length === 0) {
      parts.push("All types");
    } else if (filters.rideTypes.length === RIDE_TYPES.length) {
      parts.push("All types");
    } else {
      parts.push(filters.rideTypes.join(", "));
    }

    // Skill levels
    if (filters.skillLevels.length === 0) {
      parts.push("All skills");
    } else if (filters.skillLevels.length === SKILL_LEVELS.length) {
      parts.push("All skills");
    } else {
      parts.push(filters.skillLevels.join(", "));
    }

    // Time range
    if (filters.maxDays === 1) {
      parts.push("Today");
    } else if (filters.maxDays === 3) {
      parts.push("3 days");
    } else if (filters.maxDays === 7) {
      parts.push("7 days");
    } else if (filters.maxDays === 14) {
      parts.push("2 weeks");
    } else if (filters.maxDays === 30) {
      parts.push("30 days");
    }

    return parts.join(" • ");
  }

  function openFilterModal() {
    setDraftFilters(filters); // Copy current filters to draft
    setFilterModalVisible(true);
  }

  function applyFilters() {
    setFilters(draftFilters); // Apply draft to active
    setFilterModalVisible(false);
    // Feed will auto-reload via useEffect dependency on filters
  }

  function resetFilters() {
    const defaultFilters: RideFilters = {
      rideTypes: [],
      skillLevels: [],
      maxDays: 7,
    };
    setDraftFilters(defaultFilters);
  }

  function toggleRideType(type: string) {
    const current = draftFilters.rideTypes;
    if (current.includes(type)) {
      setDraftFilters({ ...draftFilters, rideTypes: current.filter(t => t !== type) });
    } else {
      setDraftFilters({ ...draftFilters, rideTypes: [...current, type] });
    }
  }

  function toggleSkillLevel(level: string) {
    const current = draftFilters.skillLevels;
    // Single select behavior - if clicking same level, deselect (empty = all)
    if (current.length === 1 && current[0] === level) {
      setDraftFilters({ ...draftFilters, skillLevels: [] });
    } else {
      // Select this level only
      setDraftFilters({ ...draftFilters, skillLevels: [level] });
    }
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* Filter Summary */}
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          marginBottom: 12,
          padding: 12,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8,
        }}>
          <Text style={{ flex: 1, color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
            Filters: {getFilterSummary()}
          </Text>
          <Button 
            mode="contained" 
            compact
            onPress={openFilterModal}
          >
            Edit
          </Button>
        </View>

        {/* Ride List */}
        <View style={{ gap: 12 }}>
          {rides.length === 0 ? (
            <Card>
              <Card.Content>
                <Text>No rides match your filters. Try adjusting them or create a new ride!</Text>
              </Card.Content>
            </Card>
          ) : (
            rides.map((r) => (
              <Card
                key={r.id}
                onPress={() => navigation.navigate("RideDetails", { rideId: r.id })}
              >
                <Card.Content style={{ gap: 6 }}>
                  <Text variant="titleMedium">
                    {r.ride_type} · {r.skill_level}
                  </Text>

                  <Text style={{ opacity: 0.8 }}>
                    When: {formatDateTimeLocal(r.start_at)}
                  </Text>

                  <Text style={{ opacity: 0.8 }}>
                    Where:{" "}
                    {r.start_name ??
                      `${r.start_lat.toFixed(4)}, ${r.start_lng.toFixed(4)}`}
                  </Text>

                  <Text style={{ opacity: 0.8 }}>
                    Group: {r.join_mode} · max {r.max_participants}
                  </Text>

                  {r.distance_km != null || r.elevation_m != null ? (
                    <Text style={{ opacity: 0.8 }}>
                      {r.distance_km != null ? `${r.distance_km} km` : ""}
                      {r.distance_km != null && r.elevation_m != null ? " · " : ""}
                      {r.elevation_m != null ? `${r.elevation_m} m` : ""}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Portal>
        <Modal
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            margin: 20,
            padding: 20,
            borderRadius: 8,
            maxHeight: '80%',
          }}
        >
          <ScrollView>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>
              Filter Rides
            </Text>

            {/* Ride Types */}
            <Text variant="titleMedium" style={{ marginTop: 8, marginBottom: 8 }}>
              Ride Types
            </Text>
            <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12 }}>
              Select none for all types
            </Text>
            {RIDE_TYPES.map(type => (
              <Checkbox.Item
                key={type}
                label={type}
                status={draftFilters.rideTypes.includes(type) ? "checked" : "unchecked"}
                onPress={() => toggleRideType(type)}
              />
            ))}

            <Divider style={{ marginVertical: 16 }} />

            {/* Skill Levels */}
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Skill Level
            </Text>
            <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12 }}>
              Select one or leave blank for all
            </Text>
            {SKILL_LEVELS.map(level => (
              <Checkbox.Item
                key={level}
                label={level}
                status={draftFilters.skillLevels.includes(level) ? "checked" : "unchecked"}
                onPress={() => toggleSkillLevel(level)}
              />
            ))}

            <Divider style={{ marginVertical: 16 }} />

            {/* Time Range */}
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>
              Time Range
            </Text>
            {DAY_OPTIONS.map(days => (
              <Checkbox.Item
                key={days}
                label={days === 1 ? "Today" : days === 7 ? "Next 7 days" : days === 14 ? "Next 2 weeks" : `Next ${days} days`}
                status={draftFilters.maxDays === days ? "checked" : "unchecked"}
                onPress={() => setDraftFilters({ ...draftFilters, maxDays: days })}
              />
            ))}

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <Button 
                mode="outlined" 
                onPress={resetFilters}
                style={{ flex: 1 }}
              >
                Reset
              </Button>
              <Button 
                mode="contained" 
                onPress={applyFilters}
                style={{ flex: 1 }}
              >
                Apply
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </>
  );
}
