import React from "react";
import { View } from "react-native";
import { Text, RadioButton } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../state/AppSettingsContext";
import { useTheme } from "react-native-paper";
import { changeLanguage } from "../../i18n";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useAppSettings();
  const theme = useTheme();

  const handleLanguageChange = async (newLanguage: string) => {
    await changeLanguage(newLanguage);
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        gap: 12,
        backgroundColor: theme.colors.background,
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
    </View>
  );
}
