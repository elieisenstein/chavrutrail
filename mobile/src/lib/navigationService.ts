// navigationService.ts
// JavaScript wrapper around the native BishvilNavigationModule

import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { BishvilNavigationModule } = NativeModules;

if (!BishvilNavigationModule) {
  throw new Error(
    'BishvilNavigationModule is not available. Make sure the native module is linked properly.'
  );
}

const navigationEmitter = new NativeEventEmitter(BishvilNavigationModule);

export type NavigationConfig = {
  minDistanceMeters: number;
  minHeadingDegrees: number;
  minTimeMs: number;
  motionVarianceThreshold: number;
  motionWindowMs: number;
  // Auto-dim settings
  autoDimEnabled: boolean;
  autoDimLevel: number; // 0.0-1.0 dim factor of baseline (e.g., 0.8 = 80% of baseline)
};

export type NavCommitEvent = {
  timestamp: number;
  latitude: number;
  longitude: number;
  heading: number;        // 0-360 degrees
  speed: number;          // m/s
  accuracy: number;       // meters
  drMeters: number;       // distance since last commit
  dThetaDeg: number;      // heading change since last commit
  dtMs: number;           // time since last commit
  reason: 'DR' | 'DTHETA' | 'DT' | 'INIT';
  motionState: 'MOVING' | 'STATIONARY';
};

export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  minDistanceMeters: 3,     // Very responsive - update every 3 meters
  minHeadingDegrees: 5,     // Update on small heading changes (5 degrees)
  minTimeMs: 500,           // Update every 500ms
  motionVarianceThreshold: 0.05,  // Very sensitive motion detection
  motionWindowMs: 400,      // Faster motion detection window
  // Auto-dim defaults
  autoDimEnabled: true,     // Enabled by default
  autoDimLevel: 0.8,        // Dim to 80% of baseline brightness
};

class NavigationService {
  private subscription: EmitterSubscription | null = null;
  private isActive = false;

  /**
   * Start navigation tracking with the given configuration
   * @param config Navigation configuration parameters
   * @param onUpdate Callback fired when navigation commit occurs
   */
  async startTracking(
    config: NavigationConfig,
    onUpdate: (event: NavCommitEvent) => void
  ): Promise<void> {
    if (this.isActive) {
      console.warn('Navigation tracking is already active');
      return;
    }

    try {
      // Subscribe to native events
      this.subscription = navigationEmitter.addListener('onNavCommit', onUpdate);

      // Start native tracking
      await BishvilNavigationModule.startNavigation(config);

      this.isActive = true;
      console.log('Navigation tracking started');
    } catch (error) {
      // Clean up subscription if start fails
      this.subscription?.remove();
      this.subscription = null;
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop navigation tracking
   */
  async stopTracking(): Promise<void> {
    if (!this.isActive) {
      console.warn('Navigation tracking is not active');
      return;
    }

    try {
      // Remove event subscription
      this.subscription?.remove();
      this.subscription = null;

      // Stop native tracking
      await BishvilNavigationModule.stopNavigation();

      this.isActive = false;
      console.log('Navigation tracking stopped');
    } catch (error) {
      console.error('Error stopping navigation tracking:', error);
      throw error;
    }
  }

  /**
   * Update navigation configuration while tracking
   * @param config Partial configuration to update
   */
  async updateConfig(config: Partial<NavigationConfig>): Promise<void> {
    if (!this.isActive) {
      console.warn('Cannot update config: navigation is not active');
      return;
    }

    try {
      await BishvilNavigationModule.updateConfig(config);
      console.log('Navigation config updated:', config);
    } catch (error) {
      console.error('Error updating navigation config:', error);
      throw error;
    }
  }

  /**
   * Check if navigation tracking is currently active
   */
  isTrackingActive(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const navigationService = new NavigationService();
