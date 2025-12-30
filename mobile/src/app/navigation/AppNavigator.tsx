// AppNavigator.tsx
import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";
import * as Linking from 'expo-linking'; // ← NEW
import { useNavigation } from '@react-navigation/native'; // ← NEW

import FeedScreen from "../screens/FeedScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CreateRideWizard from "../screens/createRide/CreateRideWizard";
import RideDetailsScreen from "../screens/RideDetailsScreen";
import MyRidesScreen from "../screens/MyRidesScreen";

export type AppTabsParamList = {
  FeedStack: undefined;
  MyRidesStack: undefined;
  CreateStack: undefined;
  ProfileStack: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
  RideDetails: { rideId: string };
};

export type MyRidesStackParamList = {
  MyRidesList: undefined;
  RideDetails: { rideId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

export type CreateRideStackParamList = {
  CreateRideWizard: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();
const FeedStackNav = createNativeStackNavigator<FeedStackParamList>();
const MyRidesStackNav = createNativeStackNavigator<MyRidesStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();
const CreateStackNav = createNativeStackNavigator<CreateRideStackParamList>();

function FeedStack() {
  const { t } = useTranslation();
  return (
    <FeedStackNav.Navigator>
      <FeedStackNav.Screen
        name="FeedList"
        component={FeedScreen}
        options={{ title: t("tabs.feed") }}
      />
      <FeedStackNav.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{ title: "Ride" }}
      />
    </FeedStackNav.Navigator>
  );
}

function MyRidesStack() {
  const { t } = useTranslation();
  return (
    <MyRidesStackNav.Navigator>
      <MyRidesStackNav.Screen
        name="MyRidesList"
        component={MyRidesScreen}
        options={{ title: t("tabs.myRides") }}
      />
      <MyRidesStackNav.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{ title: "Ride" }}
      />
    </MyRidesStackNav.Navigator>
  );
}

function ProfileStack() {
  const { t } = useTranslation();
  return (
    <ProfileStackNav.Navigator>
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile") }} />
      <ProfileStackNav.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title") }} />
    </ProfileStackNav.Navigator>
  );
}

function CreateStack() {
  const { t } = useTranslation();
  return (
    <CreateStackNav.Navigator>
      <CreateStackNav.Screen
        name="CreateRideWizard"
        component={CreateRideWizard}
        options={{ title: t("tabs.create") }}
      />
    </CreateStackNav.Navigator>
  );
}

// ← NEW: Deep link handler hook
function useDeepLinkHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    // Handle initial URL (app opened via link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url, navigation);
      }
    });

    // Handle subsequent links (app already open)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url, navigation);
    });

    return () => subscription.remove();
  }, [navigation]);
}

// ← NEW: Deep link parsing function
function handleDeepLink(url: string, navigation: any) {
  const { path } = Linking.parse(url);
  
  console.log('Deep link received:', url, 'path:', path);
  
  if (path?.includes('ride/')) {
    const rideId = path.split('ride/')[1];
    if (rideId) {
      // Navigate to FeedStack > RideDetails
      navigation.navigate('FeedStack', {
        screen: 'RideDetails',
        params: { rideId },
      });
    }
  }
}

export default function AppNavigator() {
  const { t } = useTranslation();
  
  // ← NEW: Enable deep link handling
  useDeepLinkHandler();

  return (
    <Tab.Navigator 
      screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: "#ff6b35",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: { 
          direction: 'ltr' 
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