// AppNavigator.tsx
import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";
import { getLastTab, setLastTab, TabName } from "../../lib/preferences";
import { checkForUpdate } from "../../lib/versionCheck";

import FeedScreen from "../screens/FeedScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CreateRideWizard from "../screens/createRide/CreateRideWizard";
import RideDetailsScreen from "../screens/RideDetailsScreen";
import MyRidesScreen from "../screens/MyRidesScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import FollowingScreen from "../screens/FollowingScreen";
import RoutePreviewScreen from "../screens/RoutePreviewScreen";
import NavigationScreen from "../screens/NavigationScreen";
import OfflineMapsScreen from "../screens/OfflineMapsScreen";

export type AppTabsParamList = {
  FeedStack: undefined;
  MyRidesStack: undefined;
  CreateStack: undefined;
  NavigationStack: undefined;
  ProfileStack: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
  RideDetails: { rideId: string };
  UserProfile: { userId: string };
  RoutePreview: { coordinates: [number, number][]; gpxUrl?: string; originalFilename?: string };
};

export type MyRidesStackParamList = {
  MyRidesList: undefined;
  RideDetails: { rideId: string };
  UserProfile: { userId: string };
  RoutePreview: { coordinates: [number, number][]; gpxUrl?: string; originalFilename?: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Following: undefined;
  OfflineMaps: undefined;
};

export type CreateRideStackParamList = {
  CreateRideWizard: undefined;
};

export type NavigationStackParamList = {
  NavigationMain: {
    route?: [number, number][];
    routeName?: string;
    gpxUrl?: string;
  };
};

const Tab = createBottomTabNavigator<AppTabsParamList>();
const FeedStackNav = createNativeStackNavigator<FeedStackParamList>();
const MyRidesStackNav = createNativeStackNavigator<MyRidesStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();
const CreateStackNav = createNativeStackNavigator<CreateRideStackParamList>();
const NavigationStackNav = createNativeStackNavigator<NavigationStackParamList>();

function FeedStack() {
  const { t } = useTranslation();
  return (
    <FeedStackNav.Navigator
      initialRouteName="FeedList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <FeedStackNav.Screen
        name="FeedList"
        component={FeedScreen}
        options={{ title: t("tabs.feed") }}
      />
      <FeedStackNav.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{
          title: "Ride",
          headerBackVisible: true,
        }}
      />
      <FeedStackNav.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: t("userProfile.title") }}
      />
      <FeedStackNav.Screen
        name="RoutePreview"
        component={RoutePreviewScreen}
        options={{ title: t("rideDetails.routePreview") }}
      />
    </FeedStackNav.Navigator>
  );
}

function MyRidesStack() {
  const { t } = useTranslation();
  return (
    <MyRidesStackNav.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <MyRidesStackNav.Screen
        name="MyRidesList"
        component={MyRidesScreen}
        options={{ title: t("tabs.myRides") }}
      />
      <MyRidesStackNav.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{
          title: "Ride",
          headerBackVisible: true,
        }}
      />
      <MyRidesStackNav.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: t("userProfile.title") }}
      />
      <MyRidesStackNav.Screen
        name="RoutePreview"
        component={RoutePreviewScreen}
        options={{ title: t("rideDetails.routePreview") }}
      />
    </MyRidesStackNav.Navigator>
  );
}

function ProfileStack() {
  const { t } = useTranslation();
  return (
    <ProfileStackNav.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile") }} />
      <ProfileStackNav.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title") }} />
      <ProfileStackNav.Screen name="Following" component={FollowingScreen} options={{ title: t("followingScreen.title") }} />
      <ProfileStackNav.Screen name="OfflineMaps" component={OfflineMapsScreen} options={{ title: t("offlineMaps.title") }} />
    </ProfileStackNav.Navigator>
  );
}

function CreateStack() {
  const { t } = useTranslation();
  return (
    <CreateStackNav.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <CreateStackNav.Screen
        name="CreateRideWizard"
        component={CreateRideWizard}
        options={{ title: t("tabs.create") }}
      />
    </CreateStackNav.Navigator>
  );
}

function NavigationStack() {
  const { t } = useTranslation();
  return (
    <NavigationStackNav.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <NavigationStackNav.Screen
        name="NavigationMain"
        component={NavigationScreen}
        options={{
          title: t("tabs.navigation"),
          headerShown: false  // Full-screen map, no header
        }}
      />
    </NavigationStackNav.Navigator>
  );
}


export default function AppNavigator() {
  const { t } = useTranslation();
  const [initialTab, setInitialTab] = useState<TabName | null>(null);

  useEffect(() => {
    getLastTab().then(setInitialTab);
    // Check for app updates on launch
    checkForUpdate();
  }, []);

  if (!initialTab) {
    return null;
  }

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenListeners={{
        state: (e) => {
          const state = e.data.state;
          if (state?.routes && state.index !== undefined) {
            const currentTab = state.routes[state.index].name as TabName;
            setLastTab(currentTab);
          }
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff6b35",  // Orange for active tab
        tabBarInactiveTintColor: "#ffffff",  // White for inactive tabs
        tabBarStyle: {
          direction: 'ltr',
          backgroundColor: '#121212',  // Material Design dark background
          borderTopColor: '#2a2a2a',  // Subtle top border
          borderTopWidth: 1,
        }
      }}
    >
      <Tab.Screen
        name="FeedStack"
        component={FeedStack}
        options={{
          tabBarLabel: t("tabs.feed"),
          tabBarIcon: ({ color, size }) => (
            <Icon source="bike" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("FeedStack", { screen: "FeedList" });
          },
        })}
      />

      <Tab.Screen
        name="MyRidesStack"
        component={MyRidesStack}
        options={{
          tabBarLabel: t("tabs.myRides"),
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar-account" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("MyRidesStack", { screen: "MyRidesList" });
          },
        })}
      />

      <Tab.Screen
        name="CreateStack"
        component={CreateStack}
        options={{
          tabBarLabel: t("tabs.create"),
          tabBarIcon: ({ color, size }) => (
            <Icon source="plus-circle" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="NavigationStack"
        component={NavigationStack}
        options={{
          tabBarLabel: t("tabs.navigation"),
          tabBarIcon: ({ color, size }) => (
            <Icon source="navigation" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          tabBarLabel: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}