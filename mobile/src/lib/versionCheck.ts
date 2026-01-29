import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

const VERSION_URL = 'https://bishvil-app.vercel.app/version.json';

export async function checkForUpdate(): Promise<void> {
  try {
    // Add cache busting to ensure we always get the latest version
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    const data = await response.json();

    const currentVersion = Constants.expoConfig?.version || '0.0.0';

    if (isNewerVersion(data.version, currentVersion)) {
      Alert.alert(
        'Update Available',
        `A new version (${data.version}) is available. Would you like to update?`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Update Now', onPress: () => Linking.openURL(data.downloadUrl) }
        ]
      );
    }
  } catch (error) {
    console.log('Version check failed:', error);
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if ((latestParts[i] || 0) > (currentParts[i] || 0)) return true;
    if ((latestParts[i] || 0) < (currentParts[i] || 0)) return false;
  }
  return false;
}
