// NavigationScreen.tsx
// Main navigation orchestration screen - minimal, stateless navigation

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import {
  RouteProp,
  useRoute,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useNavigation as useNavigationContext } from '../state/NavigationContext';

const KEEP_AWAKE_TAG = 'bishvil-navigation';
import NavigationMapView from '../../components/NavigationMapView';

type NavigationScreenParams = {
  NavigationMain: {
    route?: [number, number][];
    routeElevations?: number[]; // Elevation at each route point
    routeName?: string;
    gpxUrl?: string;
  };
};

export default function NavigationScreen() {
  const route = useRoute<RouteProp<NavigationScreenParams, 'NavigationMain'>>();
  const navigation = useNavigation();
  const theme = useTheme();

  const {
    activeNavigation,
    startNavigation,
    stopNavigation,
    toggleMode,
    debugInfo,
    wakeBrightness,
  } = useNavigationContext();

  const [isStarting, setIsStarting] = useState(false);

  // Track whether we should use route params or free navigation
  // When tab is pressed, we reset to free navigation
  const [forceFreeNavigation, setForceFreeNavigation] = useState(false);

  // Local route state for ephemeral GPX loading (not saved to database)
  const [localRoute, setLocalRoute] = useState<{
    coords: [number, number][];
    name?: string;
  } | null>(null);

  // Route priority: params (from ride details) > local GPX > none
  const paramsRouteCoords = forceFreeNavigation ? undefined : route.params?.route;
  const routeCoords = paramsRouteCoords || localRoute?.coords || undefined;
  const routeElevations = forceFreeNavigation
    ? undefined
    : route.params?.routeElevations;
  const routeName =
    (forceFreeNavigation ? undefined : route.params?.routeName) ||
    localRoute?.name ||
    undefined;

  // Track if we've already handled the current route params (by route length + first point)
  const lastRouteKeyRef = useRef<string | null>(null);

  // Create a simple key to detect route changes
  const routeKey = routeCoords
    ? `${routeCoords.length}-${routeCoords[0]?.[0]}-${routeCoords[0]?.[1]}`
    : null;

  /**
   * Hide Android status bar while this screen is focused.
   * IMPORTANT: do NOT tie this to currentPosition or any streaming state.
   */
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'none');
      StatusBar.setBarStyle('light-content');

      return () => {
        StatusBar.setHidden(false, 'none');
      };
    }, [])
  );

  /**
   * Keep screen on while Navigation tab is focused.
   */
  useFocusEffect(
    useCallback(() => {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});

      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, [])
  );

  // Listen for tab press to reset to free navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setForceFreeNavigation(true);
      setLocalRoute(null);
    });
    return unsubscribe;
  }, [navigation]);

  // Reset forceFreeNavigation when new route params come in (from ride details)
  useEffect(() => {
    if (route.params?.route) {
      setForceFreeNavigation(false);
    }
  }, [route.params?.route]);

  /**
   * Start (or restart) navigation.
   * Wrapped in useCallback to avoid stale captures inside focus effects.
   */
  const handleStartNavigation = useCallback(async () => {
    setIsStarting(true);
    try {
      if (activeNavigation.state === 'active') {
        await stopNavigation();
      }
      await startNavigation(routeCoords, routeName);
    } catch (error) {
      console.error('Failed to start navigation:', error);
    } finally {
      setIsStarting(false);
    }
  }, [
    activeNavigation.state,
    routeCoords,
    routeName,
    startNavigation,
    stopNavigation,
  ]);

  /**
   * Stop navigation when screen loses focus (separate effect with no deps).
   * This prevents stopNavigation from being called on every state change.
   */
  useFocusEffect(
    useCallback(() => {
      // No setup needed here - just cleanup on blur
      return () => {
        stopNavigation();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Empty deps: cleanup only runs on actual blur, not state changes
  );

  /**
   * Start/restart navigation when screen gains focus with (potentially new) params.
   * Uses regular useEffect to avoid cleanup issues with useFocusEffect dependencies.
   */
  useEffect(() => {
    const routeChanged = routeKey !== lastRouteKeyRef.current;
    lastRouteKeyRef.current = routeKey;

    const needsStart = activeNavigation.state === 'idle';
    const needsRestart =
      routeChanged &&
      activeNavigation.state === 'active' &&
      (routeKey !== null || activeNavigation.route !== null);

    if (needsStart || needsRestart) {
      // Fire-and-forget; handleStartNavigation manages internal state
      void handleStartNavigation();
    }
  }, [
    routeKey,
    activeNavigation.state,
    activeNavigation.route,
    handleStartNavigation,
  ]);

  // Handle loading a GPX route (ephemeral, not saved)
  const handleLoadRoute = useCallback(
    async (coords: [number, number][], name?: string) => {
      setLocalRoute({ coords, name });
      setForceFreeNavigation(false);

      setIsStarting(true);
      try {
        if (activeNavigation.state === 'active') {
          await stopNavigation();
        }
        await startNavigation(coords, name);
      } catch (error) {
        console.error('Failed to start navigation with loaded route:', error);
      } finally {
        setIsStarting(false);
      }
    },
    [activeNavigation.state, stopNavigation, startNavigation]
  );

  // Handle clearing the current route
  const handleClearRoute = useCallback(async () => {
    setLocalRoute(null);
    setForceFreeNavigation(true);

    setIsStarting(true);
    try {
      if (activeNavigation.state === 'active') {
        await stopNavigation();
      }
      await startNavigation(undefined, undefined);
    } catch (error) {
      console.error('Failed to restart as free navigation:', error);
    } finally {
      setIsStarting(false);
    }
  }, [activeNavigation.state, stopNavigation, startNavigation]);

  // Idle state - show loading (auto-starting)
  if (activeNavigation.state === 'idle' || isStarting) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.idleContainer}>
          <ActivityIndicator size="large" style={styles.loader} />
          <Text style={styles.idleTitle}>Starting navigation...</Text>
        </View>
      </View>
    );
  }

  // Active state - show map only (no controls)
  return (
    <View style={styles.container}>
      <NavigationMapView
        currentPosition={activeNavigation.currentPosition}
        route={activeNavigation.route}
        routeElevations={routeElevations}
        mode={activeNavigation.mode}
        onToggleMode={toggleMode}
        onLoadRoute={handleLoadRoute}
        onClearRoute={handleClearRoute}
        debugInfo={debugInfo}
        onWakeBrightness={wakeBrightness}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  idleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  idleTitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  loader: {
    marginTop: 24,
  },
});
