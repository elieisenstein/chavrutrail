// OfflineMapDownload.tsx
// Component for prompting offline map download and showing progress

import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import {
  Text,
  Button,
  ProgressBar,
  Surface,
  Icon,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import type { RouteBbox } from "../lib/routeMetrics";
import {
  getTilesForBbox,
  estimateDownloadSize,
} from "../lib/tileUtils";
import {
  downloadOfflinePack,
  hasStorageSpace,
  formatBytes,
  type DownloadProgress,
  type DownloadResult,
  OFFLINE_MIN_ZOOM,
  OFFLINE_MAX_ZOOM,
  OFFLINE_MARGIN_KM,
} from "../lib/offlineMapService";

type DownloadState = "prompt" | "downloading" | "success" | "error";

interface OfflineMapDownloadProps {
  bbox: RouteBbox;
  routeName: string;
  language: "he" | "en";
  mapStyle: "hiking" | "mtb";
  onDismiss: () => void;
  onComplete?: (result: DownloadResult) => void;
}

export function OfflineMapDownload({
  bbox,
  routeName,
  language,
  mapStyle,
  onDismiss,
  onComplete,
}: OfflineMapDownloadProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [state, setState] = useState<DownloadState>("prompt");
  const [progress, setProgress] = useState<DownloadProgress>({
    downloaded: 0,
    total: 0,
    percent: 0,
    failed: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [estimatedSize, setEstimatedSize] = useState<string>("");
  const [tileCount, setTileCount] = useState<number>(0);
  const [hasSpace, setHasSpace] = useState<boolean>(true);
  const [availableSpace, setAvailableSpace] = useState<string>("");

  const abortRef = useRef({ aborted: false });

  // Calculate tiles and check storage on mount
  useEffect(() => {
    const calculate = async () => {
      const tiles = getTilesForBbox(bbox, OFFLINE_MARGIN_KM, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM);
      const estimate = estimateDownloadSize(tiles.length);
      setTileCount(tiles.length);
      setEstimatedSize(estimate.formatted);

      const storage = await hasStorageSpace(estimate.bytes);
      setHasSpace(storage.hasSpace);
      setAvailableSpace(formatBytes(storage.availableBytes));
    };
    calculate();
  }, [bbox]);

  const handleDownload = async () => {
    setState("downloading");
    abortRef.current = { aborted: false };

    const result = await downloadOfflinePack(
      routeName,
      bbox,
      language,
      mapStyle,
      (prog) => setProgress(prog),
      abortRef.current
    );

    if (result.success) {
      setState("success");
    } else {
      setState("error");
      setErrorMessage(result.error || t("offlineMaps.downloadFailed"));
    }

    onComplete?.(result);
  };

  const handleCancel = () => {
    abortRef.current.aborted = true;
    onDismiss();
  };

  // Auto-dismiss after success (3 seconds)
  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, onDismiss]);

  const renderPrompt = () => (
    <>
      <View style={styles.header}>
        <Icon source="map-marker-path" size={24} color={theme.colors.primary} />
        <Text variant="titleMedium" style={{ marginLeft: 8, flex: 1 }}>
          {t("offlineMaps.downloadPromptTitle")}
        </Text>
      </View>

      <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
        {t("offlineMaps.downloadPromptMessage", {
          size: estimatedSize,
          tiles: tileCount,
        })}
      </Text>

      {!hasSpace && (
        <View style={[styles.warning, { backgroundColor: theme.colors.errorContainer }]}>
          <Icon source="alert" size={20} color={theme.colors.error} />
          <Text style={{ color: theme.colors.error, marginLeft: 8, flex: 1 }}>
            {t("offlineMaps.notEnoughSpace", { available: availableSpace })}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <Button
          mode="outlined"
          onPress={onDismiss}
          style={{ flex: 1, marginRight: 8 }}
        >
          {t("offlineMaps.notNow")}
        </Button>
        <Button
          mode="contained"
          onPress={handleDownload}
          disabled={!hasSpace}
          style={{ flex: 1 }}
          icon="download"
        >
          {t("offlineMaps.download")}
        </Button>
      </View>
    </>
  );

  const renderDownloading = () => (
    <>
      <View style={styles.header}>
        <Icon source="download" size={24} color={theme.colors.primary} />
        <Text variant="titleMedium" style={{ marginLeft: 8, flex: 1 }}>
          {t("offlineMaps.downloading")}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <ProgressBar
          progress={progress.percent / 100}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          {progress.downloaded} / {progress.total} ({progress.percent}%)
        </Text>
        {progress.failed > 0 && (
          <Text style={{ color: theme.colors.error, marginTop: 4 }}>
            {t("offlineMaps.failedTiles", { count: progress.failed })}
          </Text>
        )}
      </View>

      <Button mode="outlined" onPress={handleCancel} style={{ marginTop: 12 }}>
        {t("common.cancel")}
      </Button>
    </>
  );

  const renderSuccess = () => (
    <>
      <View style={styles.header}>
        <Icon source="check-circle" size={24} color={theme.colors.primary} />
        <Text variant="titleMedium" style={{ marginLeft: 8, flex: 1 }}>
          {t("offlineMaps.downloadComplete")}
        </Text>
      </View>

      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {t("offlineMaps.readyForOffline")}
      </Text>
    </>
  );

  const renderError = () => (
    <>
      <View style={styles.header}>
        <Icon source="alert-circle" size={24} color={theme.colors.error} />
        <Text variant="titleMedium" style={{ marginLeft: 8, flex: 1, color: theme.colors.error }}>
          {t("offlineMaps.downloadFailed")}
        </Text>
      </View>

      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {errorMessage}
      </Text>

      <View style={styles.buttons}>
        <Button mode="outlined" onPress={onDismiss} style={{ flex: 1, marginRight: 8 }}>
          {t("common.close")}
        </Button>
        <Button mode="contained" onPress={handleDownload} style={{ flex: 1 }}>
          {t("offlineMaps.retry")}
        </Button>
      </View>
    </>
  );

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.surface }]} elevation={4}>
      {state === "prompt" && renderPrompt()}
      {state === "downloading" && renderDownloading()}
      {state === "success" && renderSuccess()}
      {state === "error" && renderError()}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: "row",
    marginTop: 8,
  },
  progressContainer: {
    marginVertical: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
});
