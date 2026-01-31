// NavigationScreen.tsx
// Main navigation orchestration screen - minimal, stateless navigation

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useNavigation as useNavigationContext } from '../state/NavigationContext';
import NavigationMapView from '../../components/NavigationMapView';

type NavigationScreenParams = {
  NavigationMain: {
    route?: [number, number][];
    routeElevations?: number[];  // Elevation at each route point
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
  const routeElevations = forceFreeNavigation ? undefined : route.params?.routeElevations;
  const routeName = (forceFreeNavigation ? undefined : route.params?.routeName) || localRoute?.name || undefined;

  // Listen for tab press to reset to free navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      // When tab is pressed while already on this screen, reset to free navigation
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

  // Track if we've already handled the current params (by route length + first point)
  const lastRouteKeyRef = useRef<string | null>(null);

  // Create a simple key to detect route changes
  const routeKey = routeCoords
    ? `${routeCoords.length}-${routeCoords[0]?.[0]}-${routeCoords[0]?.[1]}`
    : null;

  // Start or restart navigation when screen gains focus with (potentially new) params
  useFocusEffect(
    useCallback(() => {
      const routeChanged = routeKey !== lastRouteKeyRef.current;
      lastRouteKeyRef.current = routeKey;

      // Start navigation if:
      // 1. Not currently navigating (idle state)
      // 2. OR route params changed (need to restart with new route)
      const needsStart = activeNavigation.state === 'idle';
      const needsRestart = routeChanged && activeNavigation.state === 'active' &&
        // Only restart if the route actually changed (not just null -> null)
        (routeKey !== null || activeNavigation.route !== null);

      if (needsStart || needsRestart) {
        handleStartNavigation();
      }

      // Cleanup: stop navigation when leaving screen
      return () => {
        if (activeNavigation.state === 'active') {
          stopNavigation();
        }
      };
    }, [routeKey, activeNavigation.state, activeNavigation.route])
  );

  const handleStartNavigation = async () => {
    setIsStarting(true);
    try {
      // Stop any existing navigation first
      if (activeNavigation.state === 'active') {
        await stopNavigation();
      }
      await startNavigation(routeCoords, routeName);
    } catch (error) {
      console.error('Failed to start navigation:', error);
    } finally {
      setIsStarting(false);
    }
  };

  // Handle loading a GPX route (ephemeral, not saved)
  const handleLoadRoute = useCallback(async (coords: [number, number][], name?: string) => {
    setLocalRoute({ coords, name });
    setForceFreeNavigation(false);

    // Restart navigation with the new route
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
  }, [activeNavigation.state, stopNavigation, startNavigation]);

  // Handle clearing the current route
  const handleClearRoute = useCallback(async () => {
    setLocalRoute(null);
    setForceFreeNavigation(true);

    // Restart as free navigation
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
