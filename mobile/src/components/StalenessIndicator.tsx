import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, Icon, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { formatCacheAge, getStalenessLevel } from "../lib/cacheService";

interface StalenessIndicatorProps {
  cacheAgeMinutes: number;
  onRefresh?: () => void;
}

export function StalenessIndicator({ cacheAgeMinutes, onRefresh }: StalenessIndicatorProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const level = getStalenessLevel(cacheAgeMinutes);
  const ageText = formatCacheAge(cacheAgeMinutes);

  // Color based on staleness level
  const getBackgroundColor = () => {
    switch (level) {
      case "fresh":
        return "#E8F5E9"; // Light green
      case "stale":
        return "#FFF8E1"; // Light yellow
      case "very-stale":
        return "#FFF3E0"; // Light orange
      case "expired":
        return "#FFEBEE"; // Light red
      default:
        return "#FFF8E1";
    }
  };

  const getIconColor = () => {
    switch (level) {
      case "fresh":
        return "#4CAF50"; // Green
      case "stale":
        return "#FFC107"; // Yellow/Amber
      case "very-stale":
        return "#FF9800"; // Orange
      case "expired":
        return "#F44336"; // Red
      default:
        return "#FFC107";
    }
  };

  const content = (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <Icon source="cloud-off-outline" size={18} color={getIconColor()} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {t("offline.offlineMode", "Offline Mode")}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t("offline.lastUpdated", "Last updated")}: {ageText}
        </Text>
      </View>
      {onRefresh && (
        <Icon source="refresh" size={20} color={theme.colors.primary} />
      )}
    </View>
  );

  if (onRefresh) {
    return (
      <TouchableOpacity onPress={onRefresh} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});
