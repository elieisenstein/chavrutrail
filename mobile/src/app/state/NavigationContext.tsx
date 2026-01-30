// NavigationContext.tsx
// Global state management for navigation - minimal, stateless design

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import {
  navigationService,
  NavCommitEvent,
  DEFAULT_NAVIGATION_CONFIG,
  NavigationConfig,
} from '../../lib/navigationService';

export type NavigationMode = 'north-up' | 'heading-up';
export type NavigationState = 'idle' | 'active';

export type NavigationPosition = {
  coordinate: [number, number]; // [lng, lat]
  heading: number;              // 0-360 degrees
  speed: number;                // m/s
  accuracy: number;             // meters
  timestamp: number;            // Unix timestamp ms
};

export type ActiveNavigation = {
  state: NavigationState;
  mode: NavigationMode;
  route: [number, number][] | null;
  routeName: string | null;
  currentPosition: NavigationPosition | null;
  lastUpdateTime: number | null;
};

export type NavigationContextValue = {
  activeNavigation: ActiveNavigation;
  startNavigation: (route?: [number, number][], routeName?: string) => Promise<void>;
  stopNavigation: () => Promise<void>;
  toggleMode: () => void;
  setMode: (mode: NavigationMode) => void;
  config: NavigationConfig;
  updateConfig: (config: Partial<NavigationConfig>) => Promise<void>;
};

const defaultNavigation: ActiveNavigation = {
  state: 'idle',
  mode: 'north-up',
  route: null,
  routeName: null,
  currentPosition: null,
  lastUpdateTime: null,
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

const CONFIG_STORAGE_KEY = '@bishvil_navigation_config';

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeNavigation, setActiveNavigation] = useState<ActiveNavigation>(defaultNavigation);
  const [config, setConfig] = useState<NavigationConfig>(DEFAULT_NAVIGATION_CONFIG);

  // Load persisted config on mount
  useEffect(() => {
    loadPersistedConfig();
  }, []);

  const loadPersistedConfig = async () => {
    try {
      const persisted = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        setConfig({ ...DEFAULT_NAVIGATION_CONFIG, ...parsed });
      }
    } catch (error) {
      console.error('Error loading persisted navigation config:', error);
    }
  };

  const persistConfig = async (newConfig: NavigationConfig) => {
    try {
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.error('Error persisting navigation config:', error);
    }
  };

  const handleNavCommit = useCallback((event: NavCommitEvent) => {
    setActiveNavigation((prev) => {
      const newPosition: NavigationPosition = {
        coordinate: [event.longitude, event.latitude],
        heading: event.heading,
        speed: event.speed,
        accuracy: event.accuracy,
        timestamp: event.timestamp,
      };

      return {
        ...prev,
        currentPosition: newPosition,
        lastUpdateTime: Date.now(),
      };
    });
  }, []);

  const startNavigation = useCallback(
    async (route?: [number, number][], routeName?: string) => {
      try {
        // Check permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Location permission is required for navigation.'
          );
          return;
        }

        // Start native tracking
        await navigationService.startTracking(config, handleNavCommit);

        // Update state
        setActiveNavigation({
          state: 'active',
          mode: 'north-up',
          route: route || null,
          routeName: routeName || null,
          currentPosition: null,
          lastUpdateTime: null,
        });

        console.log('Navigation started');
      } catch (error) {
        console.error('Error starting navigation:', error);
        Alert.alert('Error', 'Failed to start navigation. Please try again.');
      }
    },
    [config, handleNavCommit]
  );

  const stopNavigation = useCallback(async () => {
    try {
      await navigationService.stopTracking();
      setActiveNavigation(defaultNavigation);
      console.log('Navigation stopped');
    } catch (error) {
      console.error('Error stopping navigation:', error);
      Alert.alert('Error', 'Failed to stop navigation.');
    }
  }, []);

  const toggleMode = useCallback(() => {
    setActiveNavigation((prev) => ({
      ...prev,
      mode: prev.mode === 'north-up' ? 'heading-up' : 'north-up',
    }));
  }, []);

  const setMode = useCallback((mode: NavigationMode) => {
    setActiveNavigation((prev) => ({
      ...prev,
      mode,
    }));
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<NavigationConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    await persistConfig(updatedConfig);

    // Update native module if tracking is active
    if (navigationService.isTrackingActive()) {
      await navigationService.updateConfig(newConfig);
    }
  }, [config]);

  const value: NavigationContextValue = {
    activeNavigation,
    startNavigation,
    stopNavigation,
    toggleMode,
    setMode,
    config,
    updateConfig,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
