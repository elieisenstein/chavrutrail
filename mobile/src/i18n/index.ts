// index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./en.json";
import he from "./he.json";

const RTL_LANGUAGES = ["he", "ar"];
const LANGUAGE_KEY = "app_language";

function applyLayoutDirection(isRTL: boolean) {
  // Important: on Android especially, forceRTL alone is not enough.
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
  I18nManager.swapLeftAndRightInRTL(isRTL);
}

export async function initI18n(defaultLanguage: string = "he"): Promise<void> {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const initialLanguage = savedLanguage || defaultLanguage;

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  const isRTL = RTL_LANGUAGES.includes(initialLanguage);
  applyLayoutDirection(isRTL);
}

// Change language - requires manual app restart
export async function changeLanguage(languageCode: string) {
  const wasRTL = RTL_LANGUAGES.includes(i18n.language);
  const willBeRTL = RTL_LANGUAGES.includes(languageCode);

  await AsyncStorage.setItem(LANGUAGE_KEY, languageCode);
  await i18n.changeLanguage(languageCode);

  if (wasRTL !== willBeRTL) {
    applyLayoutDirection(willBeRTL);

    Alert.alert(
      languageCode === "he" ? "נדרשת הפעלה מחדש" : "Restart Required",
      languageCode === "he"
        ? "אנא סגור ופתח מחדש את האפליקציה כדי שהשפה תעודכן כראוי."
        : "Please close and reopen the app for the language to apply correctly.",
      [{ text: languageCode === "he" ? "הבנתי" : "OK" }]
    );
  }
}

export default i18n;
