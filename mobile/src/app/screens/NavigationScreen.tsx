// NavigationScreen.tsx
// Main navigation orchestration screen

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Button, Text, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useNavigation as useNavigationContext } from '../state/NavigationContext';
import NavigationMapView from '../../components/NavigationMapView';

type NavigationScreenParams = {
  NavigationMain: {
    route?: [number, number][];
    routeName?: string;
    gpxUrl?: string;
  };
};

export default function NavigationScreen() {
  const route = useRoute<RouteProp<NavigationScreenParams, 'NavigationMain'>>();
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    activeNavigation,
    startNavigation,
    stopNavigation,
    pauseNavigation,
    resumeNavigation,
    toggleMode,
  } = useNavigationContext();

  const [isStarting, setIsStarting] = useState(false);

  const routeCoords = route.params?.route;
  const routeName = route.params?.routeName;
  const isFreeNavigation = !routeCoords; // Free navigation mode when no route provided

  // Stop navigation when screen unmounts (only for route navigation)
  useEffect(() => {
    return () => {
      if (!isFreeNavigation && (activeNavigation.state === 'active' || activeNavigation.state === 'paused')) {
        // Only prompt if there's meaningful data
        if (activeNavigation.breadcrumbs.length > 5) {
          Alert.alert(
            t('navigation.stopNavigation'),
            'Are you sure you want to stop navigation?',
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.ok'),
                onPress: () => stopNavigation(),
              },
            ]
          );
        } else {
          stopNavigation();
        }
      }
    };
  }, [isFreeNavigation]);

  // Auto-start navigation
  useEffect(() => {
    if (activeNavigation.state === 'idle') {
      handleStartNavigation();
    }
  }, []);

  const handleStartNavigation = async () => {
    setIsStarting(true);
    try {
      await startNavigation(routeCoords, routeName);
    } catch (error) {
      console.error('Failed to start navigation:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopNavigation = () => {
    Alert.alert(
      t('navigation.stopNavigation'),
      'Are you sure you want to stop navigation?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.ok'),
          onPress: async () => {
            await stopNavigation();
          },
        },
      ]
    );
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    } else {
      return `${meters.toFixed(0)} m`;
    }
  };

  const elapsedTime = activeNavigation.startTime && !isFreeNavigation
    ? Date.now() - activeNavigation.startTime
    : 0;

  // Idle state - show loading (auto-starting)
  if (activeNavigation.state === 'idle') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.idleContainer}>
          <ActivityIndicator size="large" style={styles.loader} />
          <Text style={styles.idleTitle}>Starting navigation...</Text>
        </View>
      </View>
    );
  }

  // Active/Paused state - show map and controls
  return (
    <View style={styles.container}>
      {/* Map View */}
      <NavigationMapView
        currentPosition={activeNavigation.currentPosition}
        route={activeNavigation.route}
        mode={activeNavigation.mode}
        onToggleMode={toggleMode}
        totalDistanceMeters={isFreeNavigation ? undefined : activeNavigation.totalDistanceMeters}
        elapsedTimeMs={isFreeNavigation ? undefined : elapsedTime}
      />

      {/* Floating Control Buttons (icon-only) - Only show for route navigation */}
      {!isFreeNavigation && (
        <View style={styles.floatingControls}>
          {activeNavigation.state === 'active' ? (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.colors.surface }]}
              onPress={pauseNavigation}
            >
              <IconButton icon="pause" size={24} iconColor={theme.colors.onSurface} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: theme.colors.primary }]}
              onPress={resumeNavigation}
            >
              <IconButton icon="play" size={24} iconColor="#ffffff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.colors.error }]}
            onPress={handleStopNavigation}
          >
            <IconButton icon="stop" size={24} iconColor="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
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
  routeName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  startButton: {
    marginTop: 16,
    minWidth: 200,
  },
  startButtonContent: {
    height: 56,
  },
  floatingControls: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  iconButton: {
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
