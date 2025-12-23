import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import he from "./he.json";
import en from "./en.json";

export function initI18n(locale: string) {
  if (i18n.isInitialized) return;

  i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    lng: locale || "he",
    fallbackLng: "en",
    resources: {
      he: { translation: he },
      en: { translation: en }
    },
    interpolation: { escapeValue: false }
  });
}
