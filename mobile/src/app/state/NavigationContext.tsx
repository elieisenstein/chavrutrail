// NavigationContext.tsx
// Global state management for navigation - minimal, stateless design

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as Brightness from 'expo-brightness';
import {
  navigationService,
  NavCommitEvent,
  DEFAULT_NAVIGATION_CONFIG,
  NavigationConfig,
} from '../../lib/navigationService';

// Auto-dim delay when stationary (hardcoded for v1)
const AUTO_DIM_DELAY_MS = 15000;

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

// Debug info for development builds
export type DebugInfo = {
  motionState: 'MOVING' | 'STATIONARY' | null;
  brightnessCurrent: number | null;
  brightnessTarget: number;
  isDimmed: boolean;
  autoDimEnabled: boolean;
};

export type NavigationContextValue = {
  activeNavigation: ActiveNavigation;
  startNavigation: (route?: [number, number][], routeName?: string) => Promise<void>;
  stopNavigation: () => Promise<void>;
  toggleMode: () => void;
  setMode: (mode: NavigationMode) => void;
  config: NavigationConfig;
  updateConfig: (config: Partial<NavigationConfig>) => Promise<void>;
  debugInfo: DebugInfo;
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

  // Debug info state (for dev builds)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    motionState: null,
    brightnessCurrent: null,
    brightnessTarget: DEFAULT_NAVIGATION_CONFIG.autoDimLevel,
    isDimmed: false,
    autoDimEnabled: DEFAULT_NAVIGATION_CONFIG.autoDimEnabled,
  });

  // Brightness control refs (persist across renders, don't trigger re-renders)
  const originalBrightnessRef = useRef<number | null>(null);
  const isDimmedRef = useRef<boolean>(false);
  const pendingDimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMotionStateRef = useRef<'MOVING' | 'STATIONARY' | null>(null);
  // Keep a ref to config for use in callbacks without stale closure issues
  const configRef = useRef<NavigationConfig>(config);
  useEffect(() => {
    configRef.current = config;
    // Update debug info when config changes
    setDebugInfo(prev => ({
      ...prev,
      brightnessTarget: config.autoDimLevel,
      autoDimEnabled: config.autoDimEnabled,
    }));
  }, [config]);

  // Load persisted config on mount
  useEffect(() => {
    loadPersistedConfig();
  }, []);

  // Cleanup on unmount: restore brightness and clear timers
  useEffect(() => {
    return () => {
      if (pendingDimTimerRef.current) {
        clearTimeout(pendingDimTimerRef.current);
      }
      // Restore brightness synchronously if possible (best effort)
      if (isDimmedRef.current && originalBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => { });
      }
    };
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

  // Brightness control helpers
  const captureOriginalBrightness = async () => {
    if (originalBrightnessRef.current === null) {
      try {
        const brightness = await Brightness.getBrightnessAsync();
        originalBrightnessRef.current = brightness;
      } catch (error) {
        console.error('Error capturing original brightness:', error);
      }
    }
  };

  const dimScreen = async (dimFactor: number) => {
    try {
      await captureOriginalBrightness();

      const baseline = originalBrightnessRef.current;
      if (baseline === null) return;

      const minBrightness = 0.12; // optional floor, tweak later
      const target = Math.min(
        baseline,
        Math.max(minBrightness, baseline * dimFactor)
      );

      await Brightness.setBrightnessAsync(target);

      isDimmedRef.current = true;

      setDebugInfo(prev => ({
        ...prev,
        brightnessCurrent: target,
        isDimmed: true,
      }));

      console.log(
        `Screen dimmed baseline=${baseline.toFixed(2)} factor=${dimFactor.toFixed(2)} target=${target.toFixed(2)}`
      );
    } catch (error) {
      console.error('Error dimming screen:', error);
    }
  };

  const restoreBrightness = async () => {
    if (isDimmedRef.current && originalBrightnessRef.current !== null) {
      try {
        await Brightness.setBrightnessAsync(originalBrightnessRef.current);
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          brightnessCurrent: originalBrightnessRef.current,
          isDimmed: false,
        }));
        console.log('Screen brightness restored');
      } catch (error) {
        console.error('Error restoring brightness:', error);
      }
    }
    isDimmedRef.current = false;
    // Update debug info even if we weren't dimmed
    setDebugInfo(prev => ({
      ...prev,
      isDimmed: false,
    }));
    // Clear pending timer if any
    if (pendingDimTimerRef.current) {
      clearTimeout(pendingDimTimerRef.current);
      pendingDimTimerRef.current = null;
    }
  };

  const handleNavCommit = useCallback((event: NavCommitEvent) => {
    // Update position state
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

    // Handle auto-dim based on motion state
    const currentConfig = configRef.current;
    if (!currentConfig.autoDimEnabled) {
      // If disabled, ensure brightness is restored and no pending timers
      if (isDimmedRef.current) restoreBrightness();
      return;
    }

    const motionState = event.motionState;
    const prevMotionState = lastMotionStateRef.current;
    lastMotionStateRef.current = motionState;

    // Update debug info with motion state
    setDebugInfo(prev => ({
      ...prev,
      motionState,
    }));

    if (motionState === 'STATIONARY') {
      // Start dim timer if not already pending and not already dimmed
      if (!pendingDimTimerRef.current && !isDimmedRef.current) {
        pendingDimTimerRef.current = setTimeout(() => {
          // Check if still enabled and still stationary when timer fires
          if (configRef.current.autoDimEnabled && lastMotionStateRef.current === 'STATIONARY') {
            dimScreen(configRef.current.autoDimLevel);
          }
          pendingDimTimerRef.current = null;
        }, AUTO_DIM_DELAY_MS);
      }
    } else if (motionState === 'MOVING') {
      // Cancel pending timer and restore brightness
      if (pendingDimTimerRef.current) {
        clearTimeout(pendingDimTimerRef.current);
        pendingDimTimerRef.current = null;
      }
      if (isDimmedRef.current) {
        restoreBrightness();
      }
    }
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
      // Restore brightness before stopping navigation
      await restoreBrightness();
      originalBrightnessRef.current = null; // Reset for next navigation session
      lastMotionStateRef.current = null;

      await navigationService.stopTracking();
      setActiveNavigation(defaultNavigation);
      // Reset debug info motion state
      setDebugInfo(prev => ({
        ...prev,
        motionState: null,
        brightnessCurrent: null,
        isDimmed: false,
      }));
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
    debugInfo,
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
