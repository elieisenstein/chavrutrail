import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider, Text, ActivityIndicator } from "react-native-paper";
import { getLocales } from 'expo-localization';
import { View, StyleSheet, ScrollView } from "react-native";
import MapboxGL from '@rnmapbox/maps';
import { Session } from '@supabase/supabase-js';

import { initI18n } from "./src/i18n";
import { AppSettingsProvider, useAppSettings } from "./src/app/state/AppSettingsContext";
import { supabase } from "./src/lib/supabase";
import AuthScreen from "./src/app/auth/AuthScreen";
import AppNavigator from "./src/app/navigation/AppNavigator";
import { linking } from "./src/app/navigation/linking";
import { useNotifications } from './src/hooks/useNotifications';
import * as SplashScreen from 'expo-splash-screen';
import { Linking } from 'react-native';
import { checkForUpdate } from './src/lib/versionCheck';

// Initialize Mapbox
MapboxGL.setAccessToken("pk.eyJ1IjoiZWxpZWlzZW5zdGVpbiIsImEiOiJjbWpwc21iOXEzaHZzM2Nxemhzb2VtNHA3In0.NCwfmHYdr7JE0vvKRL9pFw");
MapboxGL.setTelemetryEnabled(false);

/**
 * Error Boundary to catch "Text strings must be rendered within a <Text> component"
 * and other render-time crashes.
 */
type ErrorProps = { children: React.ReactNode };
type ErrorState = { hasError: boolean; error: Error | null };

class ErrorBoundary extends React.Component<ErrorProps, ErrorState> {
  state: ErrorState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("🔥 CRITICAL RENDER ERROR:", error?.message ?? String(error));
    console.error("🔥 COMPONENT STACK:", errorInfo?.componentStack ?? "(no componentStack)");
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
            <Text style={styles.errorText}>
              {this.state.error ? this.state.error.toString() : "Unknown error"}
            </Text>
          </ScrollView>
          <Text style={styles.errorHint}>
            Check Logcat / Metro console for "🔥 COMPONENT STACK" to find the bad code.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * Inner logic of the App (Requires AppSettingsProvider context)
 */
function InnerApp() {
  const { resolvedTheme } = useAppSettings();
  const [i18nReady, setI18nReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Initialize notifications
  useNotifications();
  // Trigger Push Notification Registration
  useEffect(() => {
    const syncPushToken = async () => {
      // Check if we have an active user session
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession?.user) {
        console.log("📱 User session detected, syncing push token...");
        // This calls the registerForPushNotificationsAsync from notifications.ts
        const { registerForPushNotificationsAsync } = require('./src/lib/notifications');
        await registerForPushNotificationsAsync();
      }

      // HIDE SPLASH SCREEN (The fix for the black screen)
      // We only hide it once everything (i18n and Auth) is ready
      if (i18nReady && !authLoading) {
        await SplashScreen.hideAsync().catch(() => {
          /* Ignore errors if already hidden */
        });
      }
    };

    if (!authLoading && session) {
      syncPushToken();
    }
  }, [authLoading, session, i18nReady]); // Runs when the app finishes loading auth or the user logs in

  // Inside InnerApp useEffect
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log("Warm start link received:", url);
      // Force hide splash screen in case it's stuck on top
      SplashScreen.hideAsync().catch(() => { });
    });

    return () => subscription.remove();
  }, []);


  // Initialize i18n
  useEffect(() => {
    (async () => {
      const deviceLocale = getLocales()[0]?.languageCode || 'en';
      const deviceLanguage = deviceLocale === 'he' ? 'he' : 'en';
      await initI18n(deviceLanguage);
      setI18nReady(true);
    })();
  }, []);

  // Check for app updates on startup
  useEffect(() => {
    if (i18nReady && !authLoading) {
      checkForUpdate();
    }
  }, [i18nReady, authLoading]);

  // Handle auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!i18nReady || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PaperProvider theme={resolvedTheme}>
      <NavigationContainer linking={linking}>
        {session ? <AppNavigator /> : <AuthScreen />}
      </NavigationContainer>
    </PaperProvider>
  );
}

/**
 * Root Entry Point
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AppSettingsProvider>
        <InnerApp />
      </AppSettingsProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    justifyContent: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#d32f2f",
    marginBottom: 16,
    textAlign: 'center'
  },
  errorBox: {
    maxHeight: 220,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  errorBoxContent: {
    padding: 12,
  },
  errorText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#333",
  },
  errorHint: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});