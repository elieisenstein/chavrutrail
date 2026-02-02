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

// Storage key for tracking if we've prompted for WRITE_SETTINGS permission
const WRITE_SETTINGS_PROMPTED_KEY = '@bishvil_write_settings_prompted';

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
  const originalBrightnessRef = useRef<number | null>(null);
  const isDimmedRef = useRef<boolean>(false);
  const pendingDimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMotionStateRef = useRef<'MOVING' | 'STATIONARY' | null>(null);
  // Keep a ref to config for use in callbacks without stale closure issues
  const configRef = useRef<NavigationConfig>(config);
  // WRITE_SETTINGS permission status (null = not checked yet)
  const writeSettingsGrantedRef = useRef<boolean | null>(null);
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
      // Restore system brightness if dimmed (best effort, only if permission granted)
      if (isDimmedRef.current && originalBrightnessRef.current !== null && writeSettingsGrantedRef.current) {
        Brightness.setSystemBrightnessAsync(originalBrightnessRef.current).catch(() => { });
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

  // WRITE_SETTINGS permission helpers
  const checkWriteSettingsPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Brightness.getPermissionsAsync();
      const granted = status === 'granted';
      writeSettingsGrantedRef.current = granted;
      return granted;
    } catch (error) {
      console.error('Error checking WRITE_SETTINGS permission:', error);
      return false;
    }
  };

  const requestWriteSettingsPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Brightness.requestPermissionsAsync();
      const granted = status === 'granted';
      writeSettingsGrantedRef.current = granted;
      return granted;
    } catch (error) {
      console.error('Error requesting WRITE_SETTINGS permission:', error);
      return false;
    }
  };

  const shouldPromptForWriteSettingsPermission = async (): Promise<boolean> => {
    try {
      const prompted = await AsyncStorage.getItem(WRITE_SETTINGS_PROMPTED_KEY);
      if (!prompted) return true;

      const { timestamp } = JSON.parse(prompted);
      const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      return daysSince > 30; // 30-day cooldown
    } catch (error) {
      console.error('Error checking prompt status:', error);
      return true;
    }
  };

  const markWriteSettingsPrompted = async () => {
    try {
      await AsyncStorage.setItem(
        WRITE_SETTINGS_PROMPTED_KEY,
        JSON.stringify({ timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error marking prompt status:', error);
    }
  };

  const resetWriteSettingsPromptFlag = async () => {
    try {
      await AsyncStorage.removeItem(WRITE_SETTINGS_PROMPTED_KEY);
    } catch (error) {
      console.error('Error resetting prompt flag:', error);
    }
  };

  // Brightness control helpers
  const captureOriginalBrightness = async () => {
    if (originalBrightnessRef.current === null) {
      try {
        // Use system brightness (not window override) so user can still adjust manually
        const brightness = await Brightness.getSystemBrightnessAsync();
        originalBrightnessRef.current = brightness;
      } catch (error) {
        console.error('Error capturing original brightness:', error);
      }
    }
  };

  const dimScreen = async (dimFactor: number) => {
    try {
      // Check permission first (lazy check - only query if not known)
      if (writeSettingsGrantedRef.current === null) {
        await checkWriteSettingsPermission();
      }

      if (!writeSettingsGrantedRef.current) {
        // Permission not granted - skip dimming silently
        console.log('WRITE_SETTINGS permission not granted, skipping dim');
        return;
      }

      await captureOriginalBrightness();

      const baseline = originalBrightnessRef.current;
      if (baseline === null) return;

      const minBrightness = 0.12; // optional floor, tweak later
      const target = Math.min(
        baseline,
        Math.max(minBrightness, baseline * dimFactor)
      );

      // Use system brightness - user can still override manually
      await Brightness.setSystemBrightnessAsync(target);

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
        // Only restore if we have permission
        if (writeSettingsGrantedRef.current) {
          await Brightness.setSystemBrightnessAsync(originalBrightnessRef.current);
          console.log('Screen brightness restored');
        }
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          brightnessCurrent: originalBrightnessRef.current,
          isDimmed: false,
        }));
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

  // Permission check and request for SettingsScreen
  // showDialog callback receives handlers for "Open Settings" and "Not now" buttons
  const checkAndRequestWriteSettingsPermission = useCallback(async (
    showDialog: (onOpenSettings: () => void, onNotNow: () => void) => void,
    forcePrompt = false
  ): Promise<boolean> => {
    // First check if already granted
    const granted = await checkWriteSettingsPermission();
    if (granted) return true;

    // Check if we should prompt (respects 30-day cooldown unless forced)
    const shouldPrompt = forcePrompt || await shouldPromptForWriteSettingsPermission();
    if (!shouldPrompt) return false;

    // Show dialog and wait for user response
    return new Promise((resolve) => {
      showDialog(
        // onOpenSettings
        async () => {
          await markWriteSettingsPrompted();
          const result = await requestWriteSettingsPermission();
          resolve(result);
        },
        // onNotNow
        async () => {
          await markWriteSettingsPrompted();
          resolve(false);
        }
      );
    });
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
