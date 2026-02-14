import "dotenv/config";

function versionCodeFrom(version) {
  const [maj, min, patch] = version.split(".").map(Number);
  return maj * 10000 + min * 100 + patch;
}

const APP_VERSION = "1.0.13";

export default {
  name: "Bishvil",
  slug: "bishvil",
  owner: "elieisenstein",
  version: APP_VERSION,
  orientation: "portrait",
  icon: "./assets/logo.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  scheme: "bishvil", // ← NEW: Deep linking scheme

  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.elieisenstein.bishvil",
  },

  android: {
    supportsRtl: true,
    package: "com.elieisenstein.bishvil",
    versionCode: versionCodeFrom(APP_VERSION),
    jsEngine: "hermes",
    config: {
      // ONLY build for actual phone architectures (saves ~30MB)
      abiFilters: ["armeabi-v7a", "arm64-v8a"],
    },
    googleServicesFile: "./google-services.json", // This tells Expo where to find your file
    permissions: [
      "NOTIFICATIONS",
      "POST_NOTIFICATIONS" // This is required for Android 13+
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // ← NEW: Intent filters for deep linking
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "bishvil",
            host: "*",
          },
          {
            scheme: "https",
            host: "bishvil-app.vercel.app",
            pathPrefix: "/ride",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  web: {
    favicon: "./assets/logo.png",
  },

  extra: {
    eas: {
      projectId: "cecc5ae1-51aa-4482-904b-7f509e4ca83c",
    },
    MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
  },

  plugins: [
    "expo-notifications", // 👈 ADD THIS: This initializes Firebase on Android start
    "@react-native-community/datetimepicker",
    "expo-localization",
    "expo-document-picker",
    [
      "@rnmapbox/maps",
      {
        accessToken: process.env.MAPBOX_ACCESS_TOKEN,
      },
    ],
    // ADD THIS NEW SECTION BELOW
    [
      "expo-build-properties",
      {
        "android": {
          "enableShrinkResourcesInReleaseBuilds": true,
          "enableMinifyInReleaseBuilds": true,
          "enableProguardInReleaseBuilds": true
        }
      }
    ]
  ],
};