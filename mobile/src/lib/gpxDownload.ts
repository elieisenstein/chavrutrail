import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type DownloadResult = {
  success: boolean;
  error?: string;
};

const DOWNLOADS_DIR_URI_KEY = "gpx_downloads_directory_uri_v1";

/**
 * Downloads a GPX file and saves it into a user-selected folder.
 * Android: uses StorageAccessFramework and remembers the chosen folder (e.g., Downloads).
 * iOS: opens the share sheet (user can "Save to Files").
 */
export async function downloadGpxFile(
  gpxUrl: string,
  originalFilename: string | null,
  t: (key: string) => string
): Promise<DownloadResult> {
  try {
    const filename = sanitizeFilename(originalFilename || `route_${Date.now()}.gpx`);
    const cacheUri = `${FileSystem.cacheDirectory}${filename}`;

    // 1) Download to app cache
    const downloadResult = await FileSystem.downloadAsync(gpxUrl, cacheUri);
    if (downloadResult.status !== 200) {
      return { success: false, error: t("gpxDownload.downloadFailed") };
    }

    // 2) Platform-specific save
    if (Platform.OS === "android") {
      const saveRes = await saveToRememberedDownloadsAndroid(cacheUri, filename, t);
      if (!saveRes.success) return saveRes;

      return { success: true };
    }

    // iOS (and others): share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: t("gpxDownload.sharingNotAvailable") };
    }

    await Sharing.shareAsync(cacheUri, {
      mimeType: "application/gpx+xml",
      dialogTitle: t("gpxDownload.saveFile"),
      UTI: "com.topografix.gpx",
    });

    return { success: true };
  } catch (error) {
    console.error("GPX download error:", error);
    return { success: false, error: t("gpxDownload.downloadFailed") };
  }
}

/**
 * Android: Save to remembered directory URI (StorageAccessFramework).
 * If not remembered or no longer accessible, prompts user to pick a directory and stores it.
 */
async function saveToRememberedDownloadsAndroid(
  cacheUri: string,
  filename: string,
  t: (key: string) => string
): Promise<DownloadResult> {
  // Try remembered directory first
  const rememberedDirUri = await AsyncStorage.getItem(DOWNLOADS_DIR_URI_KEY);

  if (rememberedDirUri) {
    const attempt = await writeFileToSafDirectory(rememberedDirUri, cacheUri, filename);
    if (attempt.success) return { success: true };

    // Directory likely invalid / permission revoked -> forget and re-prompt
    await AsyncStorage.removeItem(DOWNLOADS_DIR_URI_KEY);
  }

  // Prompt user to pick folder (they should select "Downloads")
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) {
    // User canceled: optionally fall back to share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: t("gpxDownload.sharingNotAvailable") };
    }

    await Sharing.shareAsync(cacheUri, {
      mimeType: "application/gpx+xml",
      dialogTitle: t("gpxDownload.saveFile"),
      UTI: "com.topografix.gpx",
    });

    return { success: true };
  }

  // Remember chosen folder URI for next time
  await AsyncStorage.setItem(DOWNLOADS_DIR_URI_KEY, perm.directoryUri);

  const attempt = await writeFileToSafDirectory(perm.directoryUri, cacheUri, filename);
  if (!attempt.success) {
    return { success: false, error: t("gpxDownload.downloadFailed") };
  }

  return { success: true };
}

/**
 * Creates a file inside SAF directory and copies cacheUri contents into it.
 * Uses copyAsync first; falls back to read+write if needed.
 */
async function writeFileToSafDirectory(
  directoryUri: string,
  cacheUri: string,
  filename: string
): Promise<{ success: boolean; error?: unknown }> {
  try {
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      filename,
      "application/gpx+xml"
    );

    // Prefer copyAsync for binary-safe copy
    try {
      await FileSystem.copyAsync({ from: cacheUri, to: destUri });
      return { success: true };
    } catch {
      // Fallback: read as string and write
      const content = await FileSystem.readAsStringAsync(cacheUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await FileSystem.writeAsStringAsync(destUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return { success: true };
    }
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Prevents illegal characters in filenames (especially important on Android/SAF).
 */
function sanitizeFilename(name: string): string {
  // Remove path separators and control chars; keep it conservative.
  const cleaned = name
    .replace(/[\/\\]+/g, "_")
    .replace(/[\u0000-\u001F\u007F]+/g, "")
    .trim();

  // Ensure extension
  if (!cleaned.toLowerCase().endsWith(".gpx")) {
    return `${cleaned}.gpx`;
  }
  return cleaned || `route_${Date.now()}.gpx`;
}
