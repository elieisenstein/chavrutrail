import React from "react";
import { View, Alert, ScrollView } from "react-native";
import { Text, RadioButton, Switch, SegmentedButtons } from "react-native-paper";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../state/AppSettingsContext";
import { useTheme } from "react-native-paper";
import { changeLanguage } from "../../i18n";
import { useNavigation } from "../state/NavigationContext";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useAppSettings();
  const theme = useTheme();
  const { config, updateConfig, checkAndRequestWriteSettingsPermission, resetWriteSettingsPromptFlag } = useNavigation();

  const handleLanguageChange = async (newLanguage: string) => {
    await changeLanguage(newLanguage);
  };

  // Handler for auto-dim toggle that checks WRITE_SETTINGS permission
  const handleAutoDimToggle = async (value: boolean) => {
    if (value) {
      // User is enabling auto-dim - reset cooldown and check permission
      await resetWriteSettingsPromptFlag();

      const showDialog = (onOpenSettings: () => void, onNotNow: () => void) => {
        Alert.alert(
          t('permissions.writeSettings.title'),
          t('permissions.writeSettings.message'),
          [
            {
              text: t('permissions.writeSettings.notNow'),
              style: 'cancel',
              onPress: onNotNow,
            },
            {
              text: t('permissions.writeSettings.openSettings'),
              onPress: onOpenSettings,
            },
          ]
        );
      };

      // Check and request permission (forcePrompt = true since user explicitly enabled)
      await checkAndRequestWriteSettingsPermission(showDialog, true);

      // Enable the setting regardless of permission result
      // (will just silently not dim if permission not granted)
    }
    updateConfig({ autoDimEnabled: value });
  };

  // Dim level options for segmented buttons
  const dimLevelOptions = [
    { value: '0.6', label: '60%' },
    { value: '0.7', label: '70%' },
    { value: '0.8', label: '80%' },
    { value: '0.9', label: '90%' },
  ];

  // Update interval options (minTimeMs)
  const updateIntervalOptions = [
    { value: '1000', label: '1s' },
    { value: '2000', label: '2s' },
    { value: '3000', label: '3s' },
  ];

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        padding: 16,
        gap: 12,
      }}
    >
      <Text
        variant="headlineSmall"
        style={{ color: theme.colors.onSurface }}
      >
        {t("settings.title")}
      </Text>

      <View style={{ gap: 8 }}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface }}
        >
          {t("settings.theme.title")}
        </Text>
        <RadioButton.Group onValueChange={(v) => setThemeMode(v as any)} value={themeMode}>
          <RadioButton.Item label={t("settings.theme.system")} value="system" />
          <RadioButton.Item label={t("settings.theme.light")} value="light" />
          <RadioButton.Item label={t("settings.theme.dark")} value="dark" />
        </RadioButton.Group>
      </View>

      <View style={{ gap: 8 }}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface }}
        >
          {t("settings.language.title")}
        </Text>
        <RadioButton.Group
          onValueChange={handleLanguageChange}
          value={i18n.language}
        >
          <RadioButton.Item label={t("settings.language.he")} value="he" />
          <RadioButton.Item label={t("settings.language.en")} value="en" />
        </RadioButton.Group>
      </View>

      <View style={{ gap: 8 }}>
        <Text
          variant="titleMedium"
          style={{ color: theme.colors.onSurface }}
        >
          {t("settings.navigation.title")}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Text style={{ color: theme.colors.onSurface, flex: 1 }}>
            {t("settings.navigation.autoDim")}
          </Text>
          <Switch
            value={config.autoDimEnabled}
            onValueChange={handleAutoDimToggle}
          />
        </View>

        {config.autoDimEnabled && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.onSurface }}>
              {t("settings.navigation.autoDimLevel")}
            </Text>
            <SegmentedButtons
              value={config.autoDimLevel.toString()}
              onValueChange={(value) => updateConfig({ autoDimLevel: parseFloat(value) })}
              buttons={dimLevelOptions}
            />
          </View>
        )}

        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ color: theme.colors.onSurface }}>
            {t("settings.navigation.updateInterval")}
          </Text>
          <SegmentedButtons
            value={config.minTimeMs.toString()}
            onValueChange={(value) => updateConfig({ minTimeMs: parseInt(value, 10) })}
            buttons={updateIntervalOptions}
          />
        </View>
      </View>

      <Text style={{ textAlign: "center", opacity: 0.5, marginTop: 24, paddingBottom: 24 }}>
        v{Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}
