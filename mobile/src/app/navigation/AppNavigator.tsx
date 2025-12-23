import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import FeedScreen from "../screens/FeedScreen";
import CreateRideScreen from "../screens/CreateRideScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";

export type AppTabsParamList = {
  Feed: undefined;
  Create: undefined;
  ProfileStack: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();
const Stack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile") }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title") }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: t("tabs.feed") }} />
      <Tab.Screen name="Create" component={CreateRideScreen} options={{ tabBarLabel: t("tabs.create") }} />
      <Tab.Screen name="ProfileStack" component={ProfileStack} options={{ tabBarLabel: t("tabs.profile") }} />
    </Tab.Navigator>
  );
}
