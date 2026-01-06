import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Card, Text, useTheme, Button, Portal, Modal, Divider, Icon } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { listFilteredRides, Ride, type RideFilters } from "../../lib/rides";
import { fetchMyProfile } from "../../lib/profile";
import { formatDateTimeLocal } from "../../lib/datetime";
import type { FeedStackParamList } from "../navigation/AppNavigator";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Available options
const RIDE_TYPES = ["XC", "Trail", "Enduro", "Gravel", "Road"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const DAY_OPTIONS = [1, 3, 7, 14, 30];

export default function FeedScreen() {
  const { t } = useTranslation();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<FeedStackParamList>>();
  const theme = useTheme();

  // Current active filters
  const [filters, setFilters] = useState<RideFilters>({
    rideTypes: [],
    skillLevels: [],
    maxDays: 7,
  });

  // Load saved filters from AsyncStorage on mount
  React.useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('feed_filters');
        if (saved) {
          const parsedFilters = JSON.parse(saved);
          setFilters(parsedFilters);
        }
      } catch (e) {
        console.log('Error loading saved filters:', e);
      }
    })();
  }, []);

  const [userGender, setUserGender] = useState<string | null>(null);

  // Draft filters (for editing in modal before applying)
  const [draftFilters, setDraftFilters] = useState<RideFilters>(filters);

  // Load user profile to personalize feed - reload on focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const profile = await fetchMyProfile();
        if (profile) {
          // Set user gender for filtering
          setUserGender(profile.gender);

          // Set default ride type filters from profile (if they have preferences)
          if (profile.ride_type) {
            const preferredTypes = profile.ride_type.split(',').map(t => t.trim());
            if (preferredTypes.length > 0) {
              setFilters(prev => ({
                ...prev,
                rideTypes: preferredTypes,
              }));
            }
          }
        }
      })();
    }, [])
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFilteredRides(filters, userGender, 50);
      setRides(data);
    } catch (e: any) {
      console.log("Feed load error:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [filters, userGender]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => { };
    }, [load])
  );

  // Build filter summary text
  function getFilterSummary(): string {
    const parts: string[] = [];

    // Ride types
    if (filters.rideTypes.length === 0) {
      parts.push(t("feed.filterSummary.allTypes"));
    } else if (filters.rideTypes.length === RIDE_TYPES.length) {
      parts.push(t("feed.filterSummary.allTypes"));
    } else {
      parts.push(filters.rideTypes.join(", "));
    }

    // Skill levels
    if (filters.skillLevels.length === 0) {
      parts.push(t("feed.filterSummary.allSkills"));
    } else if (filters.skillLevels.length === SKILL_LEVELS.length) {
      parts.push(t("feed.filterSummary.allSkills"));
    } else {
      parts.push(filters.skillLevels.join(", "));
    }

    // Time range
    if (filters.maxDays === 1) {
      parts.push(t("timeRanges.today"));
    } else {
      parts.push(t("timeRanges.days", { count: filters.maxDays }));
    }

    return parts.join(" • ");
  }

  function openFilterModal() {
    setDraftFilters(filters);
    setFilterModalVisible(true);
  }

  async function applyFilters() {
    setFilters(draftFilters);
    setFilterModalVisible(false);

    // Save filters to AsyncStorage
    try {
      await AsyncStorage.setItem('feed_filters', JSON.stringify(draftFilters));
    } catch (e) {
      console.log('Error saving filters:', e);
    }
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
    if (current.length === 1 && current[0] === level) {
      setDraftFilters({ ...draftFilters, skillLevels: [] });
    } else {
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
            {`${t("feed.filters")}: ${getFilterSummary()}`}
          </Text>
          <Button
            mode="contained"
            compact
            onPress={openFilterModal}
          >
            {t("common.edit")}
          </Button>
        </View>

        {/* Ride List */}
        <View style={{ gap: 12 }}>
          {rides.length === 0 ? (
            <Card>
              <Card.Content style={{ alignItems: 'center', padding: 32 }}>
                <Icon source="bike-fast" size={64} color={theme.colors.outline} />
                <Text
                  variant="titleMedium"
                  style={{ marginTop: 16, marginBottom: 8, textAlign: 'center' }}
                >
                  {t("feed.noRides.title")}
                </Text>
                <Text
                  style={{ opacity: 0.7, textAlign: 'center', marginBottom: 16 }}
                >
                  {t("feed.noRides.message")}
                </Text>
                <Button
                  mode="outlined"
                  onPress={openFilterModal}
                  icon="filter-variant"
                >
                  {t("feed.noRides.adjustFilters")}
                </Button>
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
                    {t(`rideTypes.${r.ride_type}`)} · {t(`skillLevels.${r.skill_level}`)}
                    {r.pace ? ` · ${t(`paceOptions.${r.pace}`)}` : ""}
                  </Text>

                  <Text style={{ opacity: 0.8 }}>
                    {t("feed.rideCard.when")}: {(() => {
                      const startDate = new Date(r.start_at);
                      const endDate = new Date(startDate);
                      endDate.setHours(endDate.getHours() + r.duration_hours);

                      const dateStr = startDate.toLocaleDateString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                      const startTime = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                      const endTime = endDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                      return `${dateStr} ${startTime}-${endTime} (${r.duration_hours}h)`;
                    })()}
                  </Text>

                  <Text style={{ opacity: 0.8 }}>
                    {t("feed.rideCard.where")}: {r.start_name || "Location TBD"}
                  </Text>

                  {r.notes && (
                    <Text style={{ opacity: 0.8, fontStyle: 'italic' }}>
                      {t("feed.rideCard.route")}: {r.notes}
                    </Text>
                  )}

                  <Text style={{ opacity: 0.8 }}>
                    {t("feed.rideCard.group")}: {t(`rideDetails.joinModes.${r.join_mode.toLowerCase()}`)} · {t("feed.rideCard.max")} {r.max_participants}
                    {r.gender_preference !== "all" && ` · ${t(`createRide.group.genderOptions.${r.gender_preference}`)}`}
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
          }}
        >
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>
            {t("feed.filterModal.title")}
          </Text>

          {/* Ride Types */}
          <Text variant="titleMedium" style={{ marginTop: 8, marginBottom: 8 }}>
            {t("feed.filterModal.rideTypes")}
          </Text>
          <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12 }}>
            {t("feed.filterModal.rideTypesHelp")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {RIDE_TYPES.map(type => (
              <Button
                key={type}
                mode={draftFilters.rideTypes.includes(type) ? "contained" : "outlined"}
                onPress={() => toggleRideType(type)}
                buttonColor={type === "Road" && draftFilters.rideTypes.includes(type) ? "#2196F3" : undefined}
                textColor={type === "Road" && !draftFilters.rideTypes.includes(type) ? "#2196F3" : undefined}
              >
                {t(`rideTypes.${type}`)}
              </Button>
            ))}
          </View>

          <Divider style={{ marginVertical: 12 }} />

          {/* Skill Levels */}
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>
            {t("feed.filterModal.skillLevel")}
          </Text>
          <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12 }}>
            {t("feed.filterModal.skillLevelHelp")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {SKILL_LEVELS.map(level => (
              <Button
                key={level}
                mode={draftFilters.skillLevels.includes(level) ? "contained" : "outlined"}
                onPress={() => toggleSkillLevel(level)}
              >
                {t(`skillLevels.${level}`)}
              </Button>
            ))}
          </View>

          <Divider style={{ marginVertical: 12 }} />

          {/* Time Range */}
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>
            {t("feed.filterModal.timeRange")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {DAY_OPTIONS.map(days => (
              <Button
                key={days}
                mode={draftFilters.maxDays === days ? "contained" : "outlined"}
                onPress={() => setDraftFilters({ ...draftFilters, maxDays: days })}
                style={{ minWidth: 80 }}
              >
                {days === 1 ? t("timeRanges.today") : t("timeRanges.days", { count: days })}
              </Button>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Button
              mode="outlined"
              onPress={resetFilters}
              style={{ flex: 1 }}
            >
              {t("common.reset")}
            </Button>
            <Button
              mode="contained"
              onPress={applyFilters}
              style={{ flex: 1 }}
            >
              {t("common.apply")}
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
}