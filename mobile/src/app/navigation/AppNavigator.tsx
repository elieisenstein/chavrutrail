// AppNavigator.tsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";

import FeedScreen from "../screens/FeedScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CreateRideWizard from "../screens/createRide/CreateRideWizard";

// NEW
import RideDetailsScreen from "../screens/RideDetailsScreen";

export type AppTabsParamList = {
  FeedStack: undefined;
  CreateStack: undefined;
  ProfileStack: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
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

export default function AppNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="FeedStack" component={FeedStack} options={{ tabBarLabel: t("tabs.feed") }} />
      <Tab.Screen name="CreateStack" component={CreateStack} options={{ tabBarLabel: t("tabs.create") }} />
      <Tab.Screen name="ProfileStack" component={ProfileStack} options={{ tabBarLabel: t("tabs.profile") }} />
    </Tab.Navigator>
  );
}
