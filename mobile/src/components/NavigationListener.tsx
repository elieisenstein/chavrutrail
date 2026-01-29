import { useGpxFileIntent } from '../hooks/useGpxFileIntent';

/**
 * Component that listens for navigation-related events
 * Must be rendered inside NavigationContainer
 */
export function NavigationListener() {
  useGpxFileIntent();
  return null;
}
