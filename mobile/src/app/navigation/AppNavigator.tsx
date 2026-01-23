// AppNavigator.tsx
import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";

import FeedScreen from "../screens/FeedScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CreateRideWizard from "../screens/createRide/CreateRideWizard";
import RideDetailsScreen from "../screens/RideDetailsScreen";
import MyRidesScreen from "../screens/MyRidesScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import FollowingScreen from "../screens/FollowingScreen";

export type AppTabsParamList = {
  FeedStack: undefined;
  MyRidesStack: undefined;
  CreateStack: undefined;
  ProfileStack: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
  RideDetails: { rideId: string };
  UserProfile: { userId: string };
};

export type MyRidesStackParamList = {
  MyRidesList: undefined;
  RideDetails: { rideId: string };
  UserProfile: { userId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Following: undefined;
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
        options={{ title: "Ride" }}
      />
      <FeedStackNav.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: t("userProfile.title") }}
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
        options={{ title: "Ride" }}
      />
      <MyRidesStackNav.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: t("userProfile.title") }}
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


export default function AppNavigator() {
  const { t } = useTranslation();

 
  return (
    <Tab.Navigator
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