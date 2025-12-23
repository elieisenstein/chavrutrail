import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import i18n from "i18next";

import {
  ThemeMode,
  Language,
  getThemeMode,
  setThemeMode,
  getLanguage,
  setLanguage,
} from "../../lib/preferences";
import { lightTheme, darkTheme } from "../../theme/paperTheme";
import { configureRtl } from "../../lib/rtl";

type AppSettings = {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => Promise<void>;
  language: Language;
  setLanguage: (l: Language) => Promise<void>;
  resolvedTheme: typeof lightTheme;
  ready: boolean;
};

const Ctx = createContext<AppSettings | null>(null);

export function useAppSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return v;
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, _setThemeMode] = useState<ThemeMode>("system");
  const [language, _setLanguage] = useState<Language>("he");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [tm, lang] = await Promise.all([getThemeMode(), getLanguage()]);
      _setThemeMode(tm);
      _setLanguage(lang);

      await i18n.changeLanguage(lang);
      configureRtl(lang);

      setReady(true);
    })();
  }, []);

  const resolvedTheme = useMemo(() => {
    const scheme = themeMode === "system" ? systemScheme : themeMode;
    return scheme === "dark" ? darkTheme : lightTheme;
  }, [themeMode, systemScheme]);

  const setThemeModeSafe = async (m: ThemeMode) => {
    _setThemeMode(m);
    await setThemeMode(m);
  };

  const setLanguageSafe = async (l: Language) => {
    _setLanguage(l);
    await setLanguage(l);

    await i18n.changeLanguage(l);
    configureRtl(l);
  };

  const value: AppSettings = {
    themeMode,
    setThemeMode: setThemeModeSafe,
    language,
    setLanguage: setLanguageSafe,
    resolvedTheme,
    ready,
  };

  return (
    <Ctx.Provider value={value}>
      {ready ? (
        children
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      )}
    </Ctx.Provider>
  );
}
