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

// Note: WRITE_SETTINGS permission is no longer needed since we use app-level brightness
// which doesn't modify system settings. These functions are kept for API compatibility.

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
  // Permission helpers for SettingsScreen
  checkAndRequestWriteSettingsPermission: (
    showDialog: (onOpenSettings: () => void, onNotNow: () => void) => void,
    forcePrompt?: boolean
  ) => Promise<boolean>;
  resetWriteSettingsPromptFlag: () => Promise<void>;
  wakeBrightness: () => Promise<void>;
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
const MODE_STORAGE_KEY = '@bishvil_navigation_mode';

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
  const isDimmedRef = useRef<boolean>(false);
  const pendingDimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMotionStateRef = useRef<'MOVING' | 'STATIONARY' | null>(null);
  // Keep a ref to config for use in callbacks without stale closure issues
  const configRef = useRef<NavigationConfig>(config);
  // Saved mode ref for use in startNavigation
  const savedModeRef = useRef<NavigationMode>('north-up');
  useEffect(() => {
    configRef.current = config;
    // Update debug info when config changes
    setDebugInfo(prev => ({
      ...prev,
      brightnessTarget: config.autoDimLevel,
      autoDimEnabled: config.autoDimEnabled,
    }));
  }, [config]);

  // Load persisted config and mode on mount
  useEffect(() => {
    loadPersistedConfig();
    loadPersistedMode();
  }, []);

  // Cleanup on unmount: restore brightness and clear timers
  useEffect(() => {
    return () => {
      if (pendingDimTimerRef.current) {
        clearTimeout(pendingDimTimerRef.current);
      }
      // Restore app brightness if dimmed (app-level brightness auto-resets anyway)
      if (isDimmedRef.current) {
        Brightness.setBrightnessAsync(1).catch(() => { });
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

  const loadPersistedMode = async () => {
    try {
      const persisted = await AsyncStorage.getItem(MODE_STORAGE_KEY);
      if (persisted === 'heading-up' || persisted === 'north-up') {
        savedModeRef.current = persisted;
      }
    } catch (error) {
      console.error('Error loading persisted navigation mode:', error);
    }
  };

  const persistMode = async (mode: NavigationMode) => {
    try {
      savedModeRef.current = mode;
      await AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error persisting navigation mode:', error);
    }
  };

  // These functions are no longer needed since we use app-level brightness
  // which doesn't require WRITE_SETTINGS permission. Kept as no-ops for API compatibility.
  const resetWriteSettingsPromptFlag = async () => {
    // No-op: permission no longer needed
  };

  const dimScreen = async (dimFactor: number) => {
    try {
      // Get current app brightness as baseline
      const currentBrightness = await Brightness.getBrightnessAsync();

      const minBrightness = 0.12;
      const target = Math.max(minBrightness, currentBrightness * dimFactor);

      // Set app-level brightness (doesn't affect system settings or adaptive brightness)
      await Brightness.setBrightnessAsync(target);

      isDimmedRef.current = true;

      setDebugInfo(prev => ({
        ...prev,
        brightnessCurrent: target,
        isDimmed: true,
      }));

      console.log(`Screen dimmed: ${currentBrightness.toFixed(2)} → ${target.toFixed(2)}`);
    } catch (error) {
      console.error('Error dimming screen:', error);
    }
  };

  const restoreBrightness = async () => {
    if (isDimmedRef.current) {
      try {
        // Restore to full brightness (app-level, doesn't affect system)
        await Brightness.setBrightnessAsync(1);
        console.log('Screen brightness restored');
      } catch (error) {
        console.error('Error restoring brightness:', error);
      }
    }
    isDimmedRef.current = false;
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

  // Wake brightness on user interaction (tap to wake)
  const wakeBrightness = useCallback(async () => {
    // Only wake if currently dimmed and auto-dim is enabled
    if (!isDimmedRef.current || !configRef.current.autoDimEnabled) return;

    // Restore brightness
    await restoreBrightness();

    // If still stationary, start a new dim timer
    if (lastMotionStateRef.current === 'STATIONARY') {
      pendingDimTimerRef.current = setTimeout(() => {
        if (configRef.current.autoDimEnabled && lastMotionStateRef.current === 'STATIONARY') {
          dimScreen(configRef.current.autoDimLevel);
        }
        pendingDimTimerRef.current = null;
      }, AUTO_DIM_DELAY_MS);
    }
  }, []);

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

    // ALWAYS extract and propagate motion state (needed for UI regardless of auto-dim)
    // NavigationMapView depends on this for:
    // - Pulse animation when stationary
    // - Heading stabilization (use last moving heading when stationary)
    // - Auto-recenter on STATIONARY -> MOVING transition
    const motionState = event.motionState;
    const prevMotionState = lastMotionStateRef.current;
    lastMotionStateRef.current = motionState;

    // Update debug info - MUST happen regardless of auto-dim setting
    setDebugInfo(prev => ({
      ...prev,
      motionState,
    }));

    // Handle auto-dim based on motion state
    const currentConfig = configRef.current;
    if (!currentConfig.autoDimEnabled) {
      // If disabled, ensure brightness is restored and no pending timers
      if (isDimmedRef.current) restoreBrightness();
      return; // Safe to return now - motionState already propagated
    }

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

        // Get initial position immediately so arrow shows right away
        // This prevents the gap between entering navigation and first native GPS event
        let initialPosition: NavigationPosition | null = null;
        try {
          // Try fast path first (last known position)
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            const ageMs = Date.now() - (lastKnown.timestamp ?? 0);
            // Accept if less than 2 minutes old
            if (ageMs < 2 * 60 * 1000) {
              initialPosition = {
                coordinate: [lastKnown.coords.longitude, lastKnown.coords.latitude],
                heading: lastKnown.coords.heading ?? 0,
                speed: lastKnown.coords.speed ?? 0,
                accuracy: lastKnown.coords.accuracy ?? 50,
                timestamp: lastKnown.timestamp,
              };
            }
          }

          // If no valid last known, get current position (slower but reliable)
          if (!initialPosition) {
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            initialPosition = {
              coordinate: [current.coords.longitude, current.coords.latitude],
              heading: current.coords.heading ?? 0,
              speed: current.coords.speed ?? 0,
              accuracy: current.coords.accuracy ?? 50,
              timestamp: current.timestamp,
            };
          }
        } catch (locError) {
          console.warn('Could not get initial position for navigation:', locError);
          // Continue anyway - native module will provide position eventually
        }

        // Start native tracking
        await navigationService.startTracking(config, handleNavCommit);

        // Update state (use saved mode preference, use initial position if available)
        setActiveNavigation((prev) => ({
          state: 'active',
          mode: savedModeRef.current,
          route: route || null,
          routeName: routeName || null,
          currentPosition: initialPosition || prev.currentPosition,
          lastUpdateTime: initialPosition ? Date.now() : prev.lastUpdateTime,
        }));

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
    setActiveNavigation((prev) => {
      const newMode = prev.mode === 'north-up' ? 'heading-up' : 'north-up';
      persistMode(newMode);
      return { ...prev, mode: newMode };
    });
  }, []);

  const setMode = useCallback((mode: NavigationMode) => {
    persistMode(mode);
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

  // No-op: WRITE_SETTINGS permission no longer needed for app-level brightness
  const checkAndRequestWriteSettingsPermission = useCallback(async (
    _showDialog: (onOpenSettings: () => void, onNotNow: () => void) => void,
    _forcePrompt = false
  ): Promise<boolean> => {
    return true; // Always "granted" since we don't need system brightness permission
  }, []);

  const value: NavigationContextValue = {
    activeNavigation,
    startNavigation,
    stopNavigation,
    toggleMode,
    setMode,
    config,
    updateConfig,
    debugInfo,
    checkAndRequestWriteSettingsPermission,
    resetWriteSettingsPromptFlag,
    wakeBrightness,
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
