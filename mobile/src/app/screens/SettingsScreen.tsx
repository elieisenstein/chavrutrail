import React from "react";
import { View } from "react-native";
import { Text, RadioButton } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../state/AppSettingsContext";


export default function SettingsScreen() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, language, setLanguage } = useAppSettings();

  return (
    <View style={{ padding: 16, gap: 16, marginTop: 24 }}>
      <Text variant="headlineSmall">{t("settings.title")}</Text>

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{t("settings.theme.title")}</Text>
        <RadioButton.Group onValueChange={(v) => setThemeMode(v as any)} value={themeMode}>
          <RadioButton.Item label={t("settings.theme.system")} value="system" />
          <RadioButton.Item label={t("settings.theme.light")} value="light" />
          <RadioButton.Item label={t("settings.theme.dark")} value="dark" />
        </RadioButton.Group>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{t("settings.language.title")}</Text>
        <RadioButton.Group onValueChange={(v) => setLanguage(v as any)} value={language}>
          <RadioButton.Item label={t("settings.language.he")} value="he" />
          <RadioButton.Item label={t("settings.language.en")} value="en" />
        </RadioButton.Group>
      </View>
    </View>
  );
}
