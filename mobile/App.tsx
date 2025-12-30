import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider } from "react-native-paper";
import { getLocales } from 'expo-localization';
import { ActivityIndicator, View } from "react-native";
import MapboxGL from '@rnmapbox/maps';
import { Session } from '@supabase/supabase-js';

import { initI18n } from "./src/i18n";
import { AppSettingsProvider, useAppSettings } from "./src/app/state/AppSettingsContext";
import { supabase } from "./src/lib/supabase";
import AuthScreen from "./src/app/auth/AuthScreen";
import AppNavigator from "./src/app/navigation/AppNavigator";
import { linking } from "./src/app/navigation/linking"; // ← NEW

// Initialize Mapbox with your access token
MapboxGL.setAccessToken("pk.eyJ1IjoiZWxpZWlzZW5zdGVpbiIsImEiOiJjbWpwc21iOXEzaHZzM2Nxemhzb2VtNHA3In0.NCwfmHYdr7JE0vvKRL9pFw");
MapboxGL.setTelemetryEnabled(false);

function InnerApp() {
  const { resolvedTheme } = useAppSettings();
  const [i18nReady, setI18nReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Initialize i18n
  useEffect(() => {
    (async () => {
      // Detect device language: if Hebrew, use "he", otherwise "en"
      const deviceLocale = getLocales()[0]?.languageCode || 'en';
      const deviceLanguage = deviceLocale === 'he' ? 'he' : 'en';
      
      await initI18n(deviceLanguage);
      setI18nReady(true);
    })();
  }, []);

  // Handle auth state
  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading spinner while initializing
  if (!i18nReady || authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={resolvedTheme}>
      <NavigationContainer linking={linking}> {/* ← MODIFIED: Added linking prop */}
        {session ? (
          <AppNavigator />
        ) : (
          <AuthScreen />
        )}
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