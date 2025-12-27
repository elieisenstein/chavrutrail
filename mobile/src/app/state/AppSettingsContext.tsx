import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";

import {
  ThemeMode,
  getThemeMode,
  setThemeMode,
} from "../../lib/preferences";
import { lightTheme, darkTheme } from "../../theme/paperTheme";

type AppSettings = {
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => Promise<void>;
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const tm = await getThemeMode();
      _setThemeMode(tm);
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

  const value: AppSettings = {
    themeMode,
    setThemeMode: setThemeModeSafe,
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
