import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { parseGpxCoordinates, isValidGpx } from '../lib/gpx';

/**
 * Hook to handle GPX file intents (file:// and content:// URIs)
 * When the app is opened with a GPX file, this hook:
 * 1. Reads the file content
 * 2. Parses the GPX coordinates
 * 3. Navigates to the NavigationScreen with the route
 */
export function useGpxFileIntent() {
  const navigation = useNavigation<any>();
  const processingRef = useRef(false);

  const handleGpxUrl = async (url: string) => {
    // Prevent duplicate processing
    if (processingRef.current) return;

    // Only handle file:// and content:// URIs
    if (!url.startsWith('file://') && !url.startsWith('content://')) {
      return;
    }

    // Check if it's a .gpx file
    if (!url.toLowerCase().endsWith('.gpx')) {
      return;
    }

    processingRef.current = true;

    try {
      console.log('📁 GPX file intent received:', url);

      // Read file content
      let fileContent: string;
      if (url.startsWith('content://')) {
        // For content:// URIs, we need to use expo-file-system
        fileContent = await FileSystem.readAsStringAsync(url, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } else {
        // For file:// URIs, use expo-file-system as well
        fileContent = await FileSystem.readAsStringAsync(url, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      // Validate GPX content
      if (!isValidGpx(fileContent)) {
        console.error('❌ Invalid GPX file');
        processingRef.current = false;
        return;
      }

      // Parse coordinates
      const coordinates = parseGpxCoordinates(fileContent);
      if (coordinates.length === 0) {
        console.error('❌ No coordinates found in GPX file');
        processingRef.current = false;
        return;
      }

      console.log(`✅ Parsed ${coordinates.length} coordinates from GPX`);

      // Extract filename from URL
      const filename = url.split('/').pop() || 'route.gpx';

      // Navigate to NavigationMain with the route
      navigation.navigate('NavigationStack', {
        screen: 'NavigationMain',
        params: {
          route: coordinates,
          routeName: filename.replace('.gpx', ''),
        },
      });

      console.log('🧭 Navigated to NavigationMain with GPX route');
    } catch (error) {
      console.error('❌ Error processing GPX file:', error);
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    // Check initial URL (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleGpxUrl(url);
      }
    });

    // Listen for URL changes (warm start)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleGpxUrl(url);
    });

    return () => subscription.remove();
  }, []);
}
