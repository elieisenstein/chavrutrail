import * as Network from "expo-network";
import { useState, useEffect, useCallback } from "react";

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: Network.NetworkStateType | null;
};

/**
 * Hook to track network connectivity state
 * Updates automatically when connectivity changes
 */
export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true, // Optimistic default
    isInternetReachable: true,
    type: null,
  });

  const checkNetwork = useCallback(async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setState({
        isConnected: networkState.isConnected ?? false,
        isInternetReachable: networkState.isInternetReachable ?? false,
        type: networkState.type ?? null,
      });
    } catch (error) {
      console.warn("Network state check failed:", error);
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkNetwork();

    // Poll for changes (expo-network doesn't have subscription API)
    // Check every 5 seconds when app is active
    const interval = setInterval(checkNetwork, 5000);

    return () => clearInterval(interval);
  }, [checkNetwork]);

  return state;
}

/**
 * Check if device is online (one-time check)
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return (state.isConnected ?? false) && (state.isInternetReachable ?? false);
  } catch {
    return false;
  }
}

/**
 * Wrapper for fetch operations with offline fallback
 * Tries network first, falls back to cache on failure
 */
export async function fetchWithOfflineFallback<T>(
  fetchFn: () => Promise<T>,
  getCacheFn: () => Promise<T | null>,
  setCacheFn: (data: T) => Promise<void>
): Promise<{ data: T; fromCache: boolean; error?: string }> {
  // Check network first
  const online = await isOnline();

  if (online) {
    try {
      // Try network request
      const data = await fetchFn();
      // Update cache on success
      await setCacheFn(data);
      return { data, fromCache: false };
    } catch (error) {
      // Network request failed, try cache
      console.warn("Network request failed, trying cache:", error);
      const cached = await getCacheFn();
      if (cached) {
        return {
          data: cached,
          fromCache: true,
          error: "Network error, showing cached data",
        };
      }
      // No cache available, rethrow
      throw error;
    }
  } else {
    // Offline, try cache directly
    const cached = await getCacheFn();
    if (cached) {
      return {
        data: cached,
        fromCache: true,
        error: "Offline, showing cached data",
      };
    }
    throw new Error("No internet connection and no cached data available");
  }
}
