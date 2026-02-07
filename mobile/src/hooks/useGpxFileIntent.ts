import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
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
    console.log('🔗 handleGpxUrl called with:', url);

    // Prevent duplicate processing
    if (processingRef.current) {
      console.log('⏭️ Already processing, skipping');
      return;
    }

    // Only handle file:// and content:// URIs
    if (!url.startsWith('file://') && !url.startsWith('content://')) {
      console.log('⏭️ Not a file:// or content:// URI, skipping');
      return;
    }

    // For file:// URIs, check the .gpx extension
    // For content:// URIs (e.g., from WhatsApp), skip extension check -
    // Android's intent filter already matched on mimeType="application/gpx+xml"
    // We'll validate GPX content after reading the file
    if (url.startsWith('file://') && !url.toLowerCase().endsWith('.gpx')) {
      return;
    }

    processingRef.current = true;

    try {
      console.log('📁 GPX file intent received:', url);

      // Read file content
      let fileContent: string;

      if (url.startsWith('content://')) {
        // For content:// URIs, copy to cache first then read
        const cacheFile = `${FileSystem.cacheDirectory}temp_gpx_${Date.now()}.gpx`;
        await FileSystem.copyAsync({ from: url, to: cacheFile });
        fileContent = await FileSystem.readAsStringAsync(cacheFile);
        // Clean up temp file
        await FileSystem.deleteAsync(cacheFile, { idempotent: true });
      } else {
        // For file:// URIs, read directly
        fileContent = await FileSystem.readAsStringAsync(url);
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
      // For content:// URIs, the path segment may not be a filename, use default
      let filename = 'route.gpx';
      if (url.startsWith('file://')) {
        filename = url.split('/').pop() || 'route.gpx';
      }

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
