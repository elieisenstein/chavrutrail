import React, { useEffect, useState } from "react";
import { ScrollView, View, Linking, Alert } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme, Divider } from "react-native-paper";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { formatDateTimeLocal } from "../../lib/datetime";
import { supabase } from "../../lib/supabase";
import type { Ride } from "../../lib/rides";
import type { FeedStackParamList } from "../navigation/AppNavigator";
import IsraelHikingMapView from "../../components/IsraelHikingMapView";
import { ShareRideButton } from "../../components/ShareRideButton";
import {
  joinOrRequestRide,
  leaveRide,
  getMyRideParticipantStatus,
  getRideParticipantCount,
  getRideParticipants,
  approveJoinRequest,
  rejectJoinRequest,
  cancelRide,
  getUserOrganizedRidesCount,
  getUserJoinedRidesCount,
  type ParticipantWithName,
  type ParticipantStatus
} from "../../lib/rides";

type RideDetailsRoute = RouteProp<FeedStackParamList, "RideDetails">;

export default function RideDetailsScreen() {
  const route = useRoute<RideDetailsRoute>();
  const navigation = useNavigation();
  const { rideId } = route.params;
  const { t, i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<ParticipantStatus | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [participants, setParticipants] = useState<ParticipantWithName[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const theme = useTheme();

  // Navigation function - opens Google Maps or Waze
  function openNavigation(lat: number, lng: number, name: string) {
    Alert.alert(
      t("rideDetails.navigation.title"),
      `${t("rideDetails.navigation.message")} ${name}`,
      [
        {
          text: t("rideDetails.navigation.googleMaps"),
          onPress: () => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            Linking.openURL(url);
          }
        },
        {
          text: t("rideDetails.navigation.waze"),
          onPress: () => {
            const url = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
            Linking.openURL(url);
          }
        },
        {
          text: t("common.cancel"),
          style: "cancel"
        }
      ]
    );
  }

  const loadRideData = async () => {
    try {
      // Get current user ID
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      setCurrentUserId(userId ?? null);

      // 1) Fetch ride + owner display name (this is the part you want)
      const { data, error } = await supabase
        .from("rides")
        .select("*, owner:profiles!rides_owner_profile_id_fkey(display_name)")
        .eq("id", rideId)
        .eq("status", "published")
        .single();

      if (error) throw new Error(error.message);

      // Flatten owner data
      const rideData = {
        ...data,
        owner_display_name: (data as any)?.owner?.display_name ?? "Unknown",
        owner: undefined,
      } as Ride;

      // Fetch owner stats
      const [organized, joined] = await Promise.all([
        getUserOrganizedRidesCount(rideData.owner_id),
        getUserJoinedRidesCount(rideData.owner_id),
      ]);

      rideData.owner_rides_organized = organized;
      rideData.owner_rides_joined = joined;

      // IMPORTANT: set ride immediately so screen renders like Feed
      setRide(rideData);

      // 2) Fetch participant data separately so RLS errors won't kill the screen
      try {
        const [status, count, participantsList] = await Promise.all([
          getMyRideParticipantStatus(rideId),
          getRideParticipantCount(rideId),
          getRideParticipants(rideId),
        ]);

        setMyStatus(status);
        setJoinedCount(count);
        setParticipants(participantsList);
      } catch (e: any) {
        console.log("RideDetails participants load error:", e?.message ?? e);
        // Don't fail the whole screen
        setMyStatus(null);
        setJoinedCount(null);
        setParticipants([]);
      }
    } catch (e: any) {
      console.log("RideDetails load error:", e?.message ?? e);
      setRide(null);
    }
  };


  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      await loadRideData();
      if (mounted) setLoading(false);
    })();

    // Real-time subscription for participant changes
    const channel = supabase
      .channel(`ride_${rideId}_updates`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'ride_participants',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          console.log('🔄 Participant change:', payload);
          // Reload data when participants change
          if (mounted) {
            loadRideData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for ride updates (cancellation, edits, etc)
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${rideId}`,
        },
        (payload) => {
          console.log('🔄 Ride changes:', payload);
          // Reload data when ride changes
          if (mounted) {
            loadRideData();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  async function handleJoin() {
    if (!ride) return;

    try {
      setJoining(true);
      await joinOrRequestRide(ride.id, ride.join_mode);

      await loadRideData();
    } catch (e: any) {
      console.log("Join error:", e?.message ?? e);
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!ride) return;

    try {
      await leaveRide(ride.id);
      await loadRideData();
    } catch (e: any) {
      console.log("Leave error:", e?.message ?? e);
    }
  }

  async function handleCancelRide() {
    if (!ride) return;

    try {
      setCancelling(true);
      await cancelRide(ride.id);
      // Navigate back after successful cancellation
      navigation.goBack();
    } catch (e: any) {
      console.log("Cancel error:", e?.message ?? e);
      setCancelling(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!ride) return;

    try {
      setApprovingUserId(userId);
      await approveJoinRequest(ride.id, userId);
      await loadRideData();
    } catch (e: any) {
      console.log("Approve error:", e?.message ?? e);
    } finally {
      setApprovingUserId(null);
    }
  }

  async function handleReject(userId: string) {
    if (!ride) return;

    try {
      setApprovingUserId(userId);
      await rejectJoinRequest(ride.id, userId);
      await loadRideData();
    } catch (e: any) {
      console.log("Reject error:", e?.message ?? e);
    } finally {
      setApprovingUserId(null);
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.onBackground }}>
          {t("rideDetails.notFound")}
        </Text>
      </View>
    );
  }

  const joinedParticipants = participants.filter(p => p.status === 'joined');
  const pendingRequests = participants.filter(p => p.status === 'requested');
  const isOwner = currentUserId === ride.owner_id;
  const rideHasStarted = new Date(ride.start_at) < new Date();
  const rideHasEnded = new Date(new Date(ride.start_at).getTime() + ride.duration_hours * 60 * 60 * 1000) < new Date();
  const isFull = (joinedCount ?? 0) >= ride.max_participants;
  const shareTitle = `${ride.ride_type} · ${ride.skill_level}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Card>
        <Card.Content style={{ gap: 8 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            {t(`rideTypes.${ride.ride_type}`)} · {t(`skillLevels.${ride.skill_level}`)}
            {ride.pace ? ` · ${t(`paceOptions.${ride.pace}`)}` : ""}
            {ride.gender_preference !== "all" && (
              <Text style={{ color: theme.colors.primary }}>
                {" "}· {t(`createRide.group.genderOptions.${ride.gender_preference}`)}
              </Text>
            )}
          </Text>

          <Text style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>
            👤 {ride.owner_display_name} · {ride.owner_rides_organized ?? 0} organized · {ride.owner_rides_joined ?? 0} joined
          </Text>
          
          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.when")}: {(() => {
              const startDate = new Date(ride.start_at);
              const endDate = new Date(startDate);
              endDate.setHours(endDate.getHours() + ride.duration_hours);

              const dateStr = startDate.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
              const startTime = startDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
              const endTime = endDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

              return `${dateStr} ${startTime}-${endTime} (${ride.duration_hours}h)`;
            })()}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.where")}: {ride.start_name ?? `${ride.start_lat.toFixed(4)}, ${ride.start_lng.toFixed(4)}`}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.group")}: {t(`rideDetails.joinModes.${ride.join_mode.toLowerCase()}`)} · {t("rideDetails.max")} {ride.max_participants}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("createRide.group.genderPreference")}: {t(`createRide.group.genderOptions.${ride.gender_preference}`)}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            {t("rideDetails.participants")}: {joinedCount ?? "—"} / {ride.max_participants}
          </Text>

          {(ride.distance_km != null || ride.elevation_m != null) && (
            <Text style={{ opacity: 0.8 }}>
              {ride.distance_km != null ? `${ride.distance_km} km` : ""}
              {ride.distance_km != null && ride.elevation_m != null ? " · " : ""}
              {ride.elevation_m != null ? `${ride.elevation_m} m` : ""}
            </Text>
          )}

          {ride.notes ? <Text style={{ opacity: 0.9 }}>{ride.notes}</Text> : null}

          {/* Share Buttons */}
          <Divider style={{ marginVertical: 12 }} />
          <ShareRideButton
            rideId={ride.id}
            rideTitle={shareTitle}
            isHebrew={isHebrew}
            disabled={rideHasStarted}
          />

          {/* Meeting Location Map */}
          {ride.start_lat != null && ride.start_lng != null ? (
            <>
              <Divider style={{ marginVertical: 12 }} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
                {t("rideDetails.meetingLocation")}
              </Text>

              <IsraelHikingMapView
                key={`map-${ride.id}-${ride.start_lat}-${ride.start_lng}`}
                center={[Number(ride.start_lng), Number(ride.start_lat)]}
                zoom={13}
                height={250}
                interactive={false}
                markers={[{
                  coordinate: [Number(ride.start_lng), Number(ride.start_lat)],
                  id: "meeting"
                }]}
              />

              <Button
                mode="contained"
                icon="navigation"
                onPress={() => openNavigation(ride.start_lat, ride.start_lng, ride.start_name || t("rideDetails.meetingLocation"))}
                style={{ marginTop: 12 }}
                disabled={rideHasEnded}
              >
                {t("rideDetails.getDirections")}
              </Button>
            </>
          ) : null}

          {/* Participants List */}
          <Divider style={{ marginVertical: 8 }} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {t("rideDetails.participants")}
          </Text>
          {joinedParticipants.map((p) => (
            <Text key={p.user_id} style={{ opacity: 0.8, paddingLeft: 8 }}>
              • {p.display_name} {p.role === 'owner' ? `(${t("myRides.statusLabels.owner")})` : ''}
            </Text>
          ))}
          {joinedParticipants.length === 1 && joinedParticipants[0]?.role === 'owner' && (
            <Text style={{ opacity: 0.6, paddingLeft: 8, fontStyle: 'italic', marginTop: 4 }}>
              {isOwner
                ? t("rideDetails.status.waitingForOthers")
                : t("rideDetails.status.beTheFirst")}
            </Text>
          )}

          {/* Pending Requests (Owner Only) */}
          {ride.join_mode === 'approval' && isOwner && pendingRequests.length > 0 && (
            <>
              <Divider style={{ marginVertical: 8 }} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {t("rideDetails.pendingRequests")}
              </Text>
              {pendingRequests.map((p) => (
                <View
                  key={p.user_id}
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ flex: 1, opacity: 0.8 }}>
                    {p.display_name}
                  </Text>
                  <Button
                    mode="contained"
                    compact
                    loading={approvingUserId === p.user_id}
                    disabled={approvingUserId !== null}
                    onPress={() => handleApprove(p.user_id)}
                  >
                    {t("rideDetails.approve")}
                  </Button>
                  <Button
                    mode="outlined"
                    compact
                    loading={approvingUserId === p.user_id}
                    disabled={approvingUserId !== null}
                    onPress={() => handleReject(p.user_id)}
                  >
                    {t("rideDetails.reject")}
                  </Button>
                </View>
              ))}
            </>
          )}

          {/* Join/Leave/Cancel Buttons */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            {!isOwner && (
              <Button
                mode="contained"
                loading={joining}
                onPress={handleJoin}
                disabled={joining || isFull || myStatus === "joined" || myStatus === "requested"}
                style={{ flex: 1 }}
              >
                {myStatus === "joined"
                  ? t("rideDetails.actions.joined")
                  : myStatus === "requested"
                    ? t("rideDetails.actions.requested")
                    : isFull
                      ? t("rideDetails.actions.full")
                      : ride.join_mode === "express"
                        ? t("rideDetails.actions.join")
                        : t("rideDetails.actions.askToJoin")}
              </Button>
            )}

            {!isOwner && (
              <Button
                mode="outlined"
                onPress={handleLeave}
                disabled={
                  rideHasStarted ||
                  !myStatus ||
                  myStatus === "left" ||
                  myStatus === "rejected" ||
                  myStatus === "kicked"
                }
                style={{ flex: 1 }}
              >
                {t("rideDetails.actions.leave")}
              </Button>
            )}

            {isOwner && (
              <Button
                mode="contained"
                loading={cancelling}
                onPress={handleCancelRide}
                disabled={cancelling || ride.status === 'cancelled' || rideHasStarted}
                style={{ flex: 1 }}
              >
                {ride.status === 'cancelled' ? t("rideDetails.actions.cancelled") : t("rideDetails.actions.cancelRide")}
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}