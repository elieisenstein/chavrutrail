import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider } from "react-native-paper";

import { initI18n } from "./src/i18n";
import { AppSettingsProvider, useAppSettings } from "./src/app/state/AppSettingsContext";
import AuthGate from "./src/app/navigation/AuthGate";
import AppNavigator from "./src/app/navigation/AppNavigator";

initI18n("he");

function InnerApp() {
  const { resolvedTheme } = useAppSettings();

  return (
    <PaperProvider theme={resolvedTheme}>
      <NavigationContainer>
        <AuthGate>
          <AppNavigator />
        </AuthGate>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <AppSettingsProvider>
      <InnerApp />
    </AppSettingsProvider>
  );
}
