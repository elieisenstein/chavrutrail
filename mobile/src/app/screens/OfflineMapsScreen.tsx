// OfflineMapsScreen.tsx
// Screen for managing downloaded offline map packs

import React, { useState, useEffect, useCallback } from "react";
import { View, FlatList, StyleSheet, Alert } from "react-native";
import {
  Text,
  Card,
  Button,
  useTheme,
  ActivityIndicator,
  Icon,
  Divider,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import {
  getOfflinePacks,
  deleteOfflinePack,
  deleteAllPacks,
  getTotalStorageUsed,
  MAX_STORAGE_BYTES,
  formatBytes,
  formatPackDate,
  type OfflineMapPack,
} from "../../lib/offlineMapService";

export default function OfflineMapsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  const [packs, setPacks] = useState<OfflineMapPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsed, setTotalUsed] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      const [packsList, used] = await Promise.all([
        getOfflinePacks(),
        getTotalStorageUsed(),
      ]);
      setPacks(packsList);
      setTotalUsed(used);
    } catch (e) {
      console.error("Failed to load offline packs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPacks();
    }, [loadPacks])
  );

  const handleDeletePack = (pack: OfflineMapPack) => {
    Alert.alert(
      t("offlineMaps.deletePack"),
      t("offlineMaps.deletePackConfirm", { name: pack.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(pack.id);
            await deleteOfflinePack(pack.id);
            await loadPacks();
            setDeleting(null);
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    if (packs.length === 0) return;

    Alert.alert(
      t("offlineMaps.deleteAll"),
      t("offlineMaps.deleteAllConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await deleteAllPacks();
            await loadPacks();
          },
        },
      ]
    );
  };

  const renderPack = ({ item: pack }: { item: OfflineMapPack }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.packHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" numberOfLines={1}>
              {pack.name}
            </Text>
            <Text
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
            >
              {formatBytes(pack.sizeBytes)} · {pack.tileCount}{" "}
              {t("offlineMaps.tiles")}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {t("offlineMaps.downloaded")}: {formatPackDate(pack.downloadedAt)}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {t(`settings.navigation.mapStyle${pack.mapStyle === "mtb" ? "Mtb" : "Hiking"}`)} ·{" "}
              {pack.language === "he" ? "עברית" : "English"}
            </Text>
          </View>
          <Button
            mode="outlined"
            onPress={() => handleDeletePack(pack)}
            loading={deleting === pack.id}
            disabled={deleting !== null}
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.error }}
          >
            {t("common.delete")}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const usagePercent = Math.round((totalUsed / MAX_STORAGE_BYTES) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Storage Summary */}
      <View style={[styles.storageHeader, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={styles.storageInfo}>
          <Icon source="harddisk" size={24} color={theme.colors.primary} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text variant="titleSmall">
              {t("offlineMaps.storageUsed")}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {formatBytes(totalUsed)} / {formatBytes(MAX_STORAGE_BYTES)} ({usagePercent}%)
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.storageBar,
            { backgroundColor: theme.colors.surfaceDisabled },
          ]}
        >
          <View
            style={[
              styles.storageBarFill,
              {
                width: `${usagePercent}%`,
                backgroundColor:
                  usagePercent > 90
                    ? theme.colors.error
                    : usagePercent > 70
                    ? "#FFC107"
                    : theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {loading && packs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : packs.length === 0 ? (
        <View style={styles.centered}>
          <Icon source="map-marker-off" size={64} color={theme.colors.outline} />
          <Text
            variant="titleMedium"
            style={{ marginTop: 16, textAlign: "center" }}
          >
            {t("offlineMaps.noPacks")}
          </Text>
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: "center",
              marginTop: 8,
              paddingHorizontal: 32,
            }}
          >
            {t("offlineMaps.noPacksHint")}
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={packs}
            renderItem={renderPack}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
          <Divider />
          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={handleDeleteAll}
              textColor={theme.colors.error}
              style={{ borderColor: theme.colors.error }}
              icon="delete-sweep"
            >
              {t("offlineMaps.deleteAll")}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  storageHeader: {
    padding: 16,
    gap: 12,
  },
  storageInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  storageBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  storageBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 0,
  },
  packHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  footer: {
    padding: 16,
    alignItems: "center",
  },
});
