import "dotenv/config";
console.log("CONFIG MAPBOX_ACCESS_TOKEN:", process.env.MAPBOX_ACCESS_TOKEN ? "SET" : "MISSING");

export default {
  expo: {
    name: "ChavruTrail",
    slug: "chavrutrail",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,

    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },

    ios: {
      supportsTablet: true,
    },

    android: {
      package: "com.elieisenstein.chavrutrail",
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#000000",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
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
          accessToken: process.env.MAPBOX_ACCESS_TOKEN,
        },
      ],
    ],
  },
};
