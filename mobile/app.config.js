import "dotenv/config";

export default {
  name: "ChavruTrail",
  slug: "chavrutrail",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/logo.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  scheme: "chavrutrail", // ← NEW: Deep linking scheme

  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.elieisenstein.chavrutrail",
  },

  android: {
    package: "com.elieisenstein.chavrutrail",
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
            scheme: "chavrutrail",
            host: "*",
          },
          {
            scheme: "https",
            host: "chavrutrail.app",
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
      projectId: "9cf48d40-4f8e-421d-b94d-8609e4dba89b",
    },
    MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
  },

  plugins: [
    "@react-native-community/datetimepicker",
    "expo-localization",
    [
      "@rnmapbox/maps",
      {
        accessToken: "pk.eyJ1IjoiZWxpZWlzZW5zdGVpbiIsImEiOiJjbWpwc21iOXEzaHZzM2Nxemhzb2VtNHA3In0.NCwfmHYdr7JE0vvKRL9pFw",
      },
    ],
  ],
};