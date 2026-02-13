import React from "react";
import { View, Alert, ScrollView, TouchableOpacity } from "react-native";
import { Text, RadioButton, Switch, SegmentedButtons, IconButton, Icon } from "react-native-paper";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../state/AppSettingsContext";
import { useTheme } from "react-native-paper";
import { changeLanguage } from "../../i18n";
import { useNavigation } from "../state/NavigationContext";
import { useNavigation as useStackNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/AppNavigator";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useAppSettings();
  const theme = useTheme();
  const { config, updateConfig, checkAndRequestWriteSettingsPermission, resetWriteSettingsPromptFlag } = useNavigation();
  const stackNavigation = useStackNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.colors.onSurface }}>
                {t("settings.navigation.autoDimLevel")}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <IconButton
                  icon="minus"
                  size={20}
                  mode="contained-tonal"
                  disabled={config.autoDimLevel <= 0.3}
                  onPress={() => updateConfig({ autoDimLevel: Math.round((config.autoDimLevel - 0.1) * 10) / 10 })}
                />
                <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold', minWidth: 45, textAlign: 'center' }}>
                  {Math.round(config.autoDimLevel * 100)}%
                </Text>
                <IconButton
                  icon="plus"
                  size={20}
                  mode="contained-tonal"
                  disabled={config.autoDimLevel >= 0.9}
                  onPress={() => updateConfig({ autoDimLevel: Math.round((config.autoDimLevel + 0.1) * 10) / 10 })}
                />
              </View>
            </View>
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

        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ color: theme.colors.onSurface }}>
            {t("settings.navigation.mapStyle")}
          </Text>
          <SegmentedButtons
            value={config.mapStyle}
            onValueChange={(value) => updateConfig({ mapStyle: value as 'hiking' | 'mtb' })}
            buttons={[
              { value: 'hiking', label: t("settings.navigation.mapStyleHiking") },
              { value: 'mtb', label: t("settings.navigation.mapStyleMtb") },
            ]}
          />
        </View>

        {/* Offline Maps Link */}
        <TouchableOpacity
          onPress={() => stackNavigation.navigate("OfflineMaps")}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
            marginTop: 8,
            borderTopWidth: 1,
            borderTopColor: theme.colors.outline,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon source="map-marker-path" size={24} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>
              {t("offlineMaps.title")}
            </Text>
          </View>
          <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <Text style={{ textAlign: "center", opacity: 0.5, marginTop: 24, paddingBottom: 24 }}>
        v{Constants.expoConfig?.version}
      </Text>
    </ScrollView>
  );
}
