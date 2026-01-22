import React, { useCallback, useState } from "react";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { Text, Button, useTheme, Divider, ActivityIndicator, Card } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getFollowingList, unfollowUser, type FollowWithProfile } from "../../lib/follows";
import { getUserOrganizedRidesCount, getUserJoinedRidesCount } from "../../lib/rides";
import type { ProfileStackParamList } from "../navigation/AppNavigator";

type FollowingWithStats = FollowWithProfile & {
  stats: { organized: number; joined: number };
};

export default function FollowingScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  const [following, setFollowing] = useState<FollowingWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  const isRTL = i18n.language === "he";

  const dirText = {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  } as const;

  const loadFollowing = useCallback(async () => {
    try {
      const list = await getFollowingList();

      // Fetch stats for each followed user
      const withStats = await Promise.all(
        list.map(async (item) => {
          const [organized, joined] = await Promise.all([
            getUserOrganizedRidesCount(item.following_id),
            getUserJoinedRidesCount(item.following_id),
          ]);
          return {
            ...item,
            stats: { organized, joined },
          };
        })
      );

      setFollowing(withStats);
    } catch (e) {
      console.log("Error loading following list:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadFollowing();
    }, [loadFollowing])
  );

  const handleUnfollow = async (userId: string) => {
    setUnfollowingId(userId);
    try {
      await unfollowUser(userId);
      navigation.goBack();
    } catch (e) {
      console.log("Error unfollowing:", e);
      setUnfollowingId(null);
    }
  };

  const navigateToProfile = (userId: string) => {
    // Navigate to FeedStack's UserProfile since ProfileStack doesn't have it
    // We need to use a workaround - navigate to parent and then to the screen
    (navigation as any).navigate("FeedStack", {
      screen: "UserProfile",
      params: { userId },
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (following.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: theme.colors.background }}>
        <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
          {t("followingScreen.empty")}
        </Text>
        <Text style={{ opacity: 0.7, textAlign: "center", ...dirText }}>
          {t("followingScreen.emptyHint")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {following.map((item, index) => (
        <View key={item.id}>
          <TouchableOpacity
            onPress={() => navigateToProfile(item.following_id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, ...dirText }}>
                {item.profile?.display_name || "Unknown"}
              </Text>
              <Text style={{ opacity: 0.7, fontSize: 12, ...dirText }}>
                {t("userProfile.stats", { organized: item.stats.organized, joined: item.stats.joined })}
              </Text>
            </View>
            <Button
              mode="outlined"
              compact
              loading={unfollowingId === item.following_id}
              disabled={unfollowingId !== null}
              onPress={() => handleUnfollow(item.following_id)}
            >
              {t("userProfile.unfollow")}
            </Button>
          </TouchableOpacity>
          {index < following.length - 1 && <Divider />}
        </View>
      ))}
    </ScrollView>
  );
}
