// NavigationScreen.tsx
// Main navigation orchestration screen

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Text, useTheme, ActivityIndicator } from 'react-native-paper';
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

  // Stop navigation when screen unmounts
  useEffect(() => {
    return () => {
      if (activeNavigation.state === 'active' || activeNavigation.state === 'paused') {
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
  }, []);

  // Auto-start navigation if route is provided and not already active
  useEffect(() => {
    if (routeCoords && activeNavigation.state === 'idle') {
      handleStartNavigation();
    }
  }, [routeCoords]);

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

  const elapsedTime = activeNavigation.startTime
    ? Date.now() - activeNavigation.startTime
    : 0;

  // Idle state - show start button
  if (activeNavigation.state === 'idle') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.idleContainer}>
          <Text style={styles.idleTitle}>{t('navigation.noRoute')}</Text>
          {routeName && (
            <Text style={styles.routeName}>{routeName}</Text>
          )}
          {isStarting ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              icon="navigation"
              onPress={handleStartNavigation}
              style={styles.startButton}
              contentStyle={styles.startButtonContent}
            >
              {t('navigation.startNavigation')}
            </Button>
          )}
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
      />

      {/* Stats Panel */}
      {activeNavigation.currentPosition && (
        <View style={[styles.statsPanel, { backgroundColor: 'rgba(18, 18, 18, 0.9)' }]}>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('navigation.distance')}</Text>
              <Text style={styles.statValue}>
                {formatDistance(activeNavigation.totalDistanceMeters)}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{t('navigation.time')}</Text>
              <Text style={styles.statValue}>
                {formatDuration(elapsedTime)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Control Buttons */}
      <View style={[styles.controlPanel, { backgroundColor: theme.colors.surface }]}>
        {activeNavigation.state === 'active' ? (
          <Button
            mode="outlined"
            icon="pause"
            onPress={pauseNavigation}
            style={styles.controlButton}
          >
            {t('navigation.pauseNavigation')}
          </Button>
        ) : (
          <Button
            mode="contained"
            icon="play"
            onPress={resumeNavigation}
            style={styles.controlButton}
          >
            {t('navigation.resumeNavigation')}
          </Button>
        )}
        <Button
          mode="contained"
          icon="stop"
          onPress={handleStopNavigation}
          style={[styles.controlButton, { backgroundColor: theme.colors.error }]}
        >
          {t('navigation.stopNavigation')}
        </Button>
      </View>

      {/* Route Name Header */}
      {activeNavigation.routeName && (
        <View style={[styles.routeNameHeader, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <Text style={styles.routeNameText}>{activeNavigation.routeName}</Text>
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
  statsPanel: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#aaaaaa',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  controlButton: {
    flex: 1,
  },
  routeNameHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: 'center',
  },
  routeNameText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
