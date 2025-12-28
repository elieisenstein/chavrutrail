import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider } from "react-native-paper";
import { getLocales } from 'expo-localization';
import { ActivityIndicator, View } from "react-native";
import MapboxGL from '@rnmapbox/maps';

import { initI18n } from "./src/i18n";
import { AppSettingsProvider, useAppSettings } from "./src/app/state/AppSettingsContext";
import AuthGate from "./src/app/navigation/AuthGate";
import AppNavigator from "./src/app/navigation/AppNavigator";

// Initialize Mapbox with your access token
// Make sure you have EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env file
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

function InnerApp() {
  const { resolvedTheme } = useAppSettings();
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Detect device language: if Hebrew, use "he", otherwise "en"
      const deviceLocale = getLocales()[0]?.languageCode || 'en';
      const deviceLanguage = deviceLocale === 'he' ? 'he' : 'en';
      
      await initI18n(deviceLanguage);
      setI18nReady(true);
    })();
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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