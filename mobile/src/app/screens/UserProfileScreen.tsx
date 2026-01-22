import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Chip, useTheme, Divider, ActivityIndicator, Button } from "react-native-paper";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { fetchUserProfile, Profile, stringToRideTypes } from "../../lib/profile";
import { getUserOrganizedRidesCount, getUserJoinedRidesCount } from "../../lib/rides";
import { followUser, unfollowUser, isFollowing } from "../../lib/follows";
import { supabase } from "../../lib/supabase";

type UserProfileRouteParams = {
  UserProfile: { userId: string };
};

export default function UserProfileScreen() {
  const route = useRoute<RouteProp<UserProfileRouteParams, "UserProfile">>();
  const { userId } = route.params;
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ organized: 0, joined: 0 });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isRTL = i18n.language === "he";

  const dirText = {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  } as const;

  const chipTextDir = {
    writingDirection: isRTL ? "rtl" : "ltr",
    textAlign: "center" as const,
  };

  const chipRowStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: 16,
    justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
  };

  useEffect(() => {
    (async () => {
      try {
        // Get current user ID
        const { data: sessionData } = await supabase.auth.getSession();
        const myUserId = sessionData.session?.user.id ?? null;
        setCurrentUserId(myUserId);

        const [profileData, organized, joined] = await Promise.all([
          fetchUserProfile(userId),
          getUserOrganizedRidesCount(userId),
          getUserJoinedRidesCount(userId),
        ]);
        setProfile(profileData);
        setStats({ organized, joined });

        // Check if following (only if not viewing own profile)
        if (myUserId && myUserId !== userId) {
          const isFollowingUser = await isFollowing(userId);
          setFollowing(isFollowingUser);
        }
      } catch (e) {
        console.log("Error loading user profile:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
    } catch (e) {
      console.log("Error toggling follow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const isOwnProfile = currentUserId === userId;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.onSurface }}>{t("userProfile.noProfile")}</Text>
      </View>
    );
  }

  const rideTypes = stringToRideTypes(profile.ride_type);
  const rideTypesDisplay = isRTL ? [...rideTypes].reverse() : rideTypes;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {/* Display Name */}
      <Text variant="headlineMedium" style={{ marginBottom: 4, ...dirText }}>
        {profile.display_name}
      </Text>

      {/* Stats */}
      <Text style={{ opacity: 0.7, marginBottom: 12, ...dirText }}>
        {t("userProfile.stats", { organized: stats.organized, joined: stats.joined })}
      </Text>

      {/* Follow Button - only show if not own profile */}
      {!isOwnProfile && (
        <Button
          mode={following ? "outlined" : "contained"}
          onPress={handleFollowToggle}
          loading={followLoading}
          disabled={followLoading}
          icon={following ? "check" : "account-plus"}
          style={{ marginBottom: 16 }}
        >
          {following ? t("userProfile.following") : t("userProfile.follow")}
        </Button>
      )}

      <Divider style={{ marginBottom: 16 }} />

      {/* Bio */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("userProfile.sections.about")}
      </Text>
      <Text style={{ opacity: 0.8, marginBottom: 16, ...dirText }}>
        {profile.bio || t("userProfile.noBio")}
      </Text>

      <Divider style={{ marginBottom: 16 }} />

      {/* Ride Types */}
      {rideTypes.length > 0 && (
        <>
          <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
            {t("userProfile.sections.rideTypes")}
          </Text>
          <View style={chipRowStyle}>
            {rideTypesDisplay.map((type) => (
              <Chip
                key={type}
                mode="outlined"
                style={{ backgroundColor: "transparent" }}
                textStyle={{
                  ...chipTextDir,
                  color: theme.colors.onSurface,
                }}
              >
                {t(`rideTypes.${type}`)}
              </Chip>
            ))}
          </View>
          <Divider style={{ marginBottom: 16 }} />
        </>
      )}

      {/* Skill & Pace */}
      {(profile.skill || profile.pace) && (
        <>
          <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
            {t("userProfile.sections.skillAndPace")}
          </Text>
          <View style={chipRowStyle}>
            {profile.skill && (
              <Chip
                mode="outlined"
                style={{ backgroundColor: "transparent" }}
                textStyle={{
                  ...chipTextDir,
                  color: theme.colors.onSurface,
                }}
              >
                {t(`skillLevels.${profile.skill}`)}
              </Chip>
            )}
            {profile.pace && (
              <Chip
                mode="outlined"
                style={{ backgroundColor: "transparent" }}
                textStyle={{
                  ...chipTextDir,
                  color: theme.colors.onSurface,
                }}
              >
                {t(`paceOptions.${profile.pace}`)}
              </Chip>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
