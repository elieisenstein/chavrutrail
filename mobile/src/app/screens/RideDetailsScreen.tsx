import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme, Divider } from "react-native-paper";
import { RouteProp, useRoute } from "@react-navigation/native";

import { formatDateTimeLocal } from "../../lib/datetime";
import { supabase } from "../../lib/supabase";
import type { Ride } from "../../lib/rides";
import type { FeedStackParamList } from "../navigation/AppNavigator";
import { 
  joinOrRequestRide, 
  leaveRide, 
  getMyRideParticipantStatus, 
  getRideParticipantCount,
  getRideParticipants,
  approveJoinRequest,
  rejectJoinRequest,
  cancelRide, // ← NEW for owner cancellation
  type ParticipantWithName,
  type ParticipantStatus 
} from "../../lib/rides";

type RideDetailsRoute = RouteProp<FeedStackParamList, "RideDetails">;

export default function RideDetailsScreen() {
  const route = useRoute<RideDetailsRoute>();
  const { rideId } = route.params;

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<ParticipantStatus | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [participants, setParticipants] = useState<ParticipantWithName[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false); // ← NEW state for cancel loading
  
  const theme = useTheme();

  const loadRideData = async () => {
    try {
      // Get current user ID
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      setCurrentUserId(userId ?? null);

      // Fetch ride details
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (error) throw new Error(error.message);
      setRide(data as Ride);

      // Fetch participant data
      const [status, count, participantsList] = await Promise.all([
        getMyRideParticipantStatus(rideId),
        getRideParticipantCount(rideId),
        getRideParticipants(rideId),
      ]);

      setMyStatus(status);
      setJoinedCount(count);
      setParticipants(participantsList);
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

    return () => {
      mounted = false;
    };
  }, [rideId]);

  async function handleJoin() {
    if (!ride) return;

    try {
      setJoining(true);
      await joinOrRequestRide(ride.id, ride.join_mode);
      
      // Reload all data
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
      
      // Reload all data
      await loadRideData();
    } catch (e: any) {
      console.log("Leave error:", e?.message ?? e);
    }
  }

  // ============ NEW FUNCTION: Cancel Ride (Owner Only) ============
  async function handleCancelRide() {
    if (!ride) return;

    try {
      setCancelling(true);
      await cancelRide(ride.id);
      
      // Reload to show cancelled status
      await loadRideData();
    } catch (e: any) {
      console.log("Cancel error:", e?.message ?? e);
    } finally {
      setCancelling(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!ride) return;

    try {
      setApprovingUserId(userId);
      await approveJoinRequest(ride.id, userId);
      
      // Reload all data to update UI
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
      
      // Reload all data to update UI
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
          Ride not found (or you don't have permission).
        </Text>
      </View>
    );
  }

  const joinedParticipants = participants.filter(p => p.status === 'joined');
  const pendingRequests = participants.filter(p => p.status === 'requested');
  const isOwner = currentUserId === ride.owner_id;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Card>
        <Card.Content style={{ gap: 8 }}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
            {ride.ride_type} · {ride.skill_level}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            When: {formatDateTimeLocal(ride.start_at)}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            Where: {ride.start_name ?? `${ride.start_lat.toFixed(4)}, ${ride.start_lng.toFixed(4)}`}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            Group: {ride.join_mode} · max {ride.max_participants}
          </Text>

          <Text style={{ opacity: 0.8 }}>
            Participants: {joinedCount ?? "—"} / {ride.max_participants}
          </Text>

          {(ride.distance_km != null || ride.elevation_m != null) && (
            <Text style={{ opacity: 0.8 }}>
              {ride.distance_km != null ? `${ride.distance_km} km` : ""}
              {ride.distance_km != null && ride.elevation_m != null ? " · " : ""}
              {ride.elevation_m != null ? `${ride.elevation_m} m` : ""}
            </Text>
          )}

          {ride.notes ? <Text style={{ opacity: 0.9 }}>{ride.notes}</Text> : null}

          {/* ============ PARTICIPANTS LIST ============ */}
          {joinedParticipants.length > 0 && (
            <>
              <Divider style={{ marginVertical: 8 }} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Participants
              </Text>
              {joinedParticipants.map((p) => (
                <Text key={p.user_id} style={{ opacity: 0.8, paddingLeft: 8 }}>
                  • {p.display_name} {p.role === 'owner' ? '(Owner)' : ''}
                </Text>
              ))}
            </>
          )}

          {/* ============ PENDING REQUESTS (OWNER ONLY) ============ */}
          {ride.join_mode === 'approval' && isOwner && pendingRequests.length > 0 && (
            <>
              <Divider style={{ marginVertical: 8 }} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Pending Requests
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
                    Approve
                  </Button>
                  <Button 
                    mode="outlined" 
                    compact
                    loading={approvingUserId === p.user_id}
                    disabled={approvingUserId !== null}
                    onPress={() => handleReject(p.user_id)}
                  >
                    Reject
                  </Button>
                </View>
              ))}
            </>
          )}

          {/* ============ UPDATED: JOIN/LEAVE/CANCEL BUTTONS ============ */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            {/* Join/Request Button (for non-owners) */}
            {!isOwner && (
              <Button
                mode="contained"
                loading={joining}
                onPress={handleJoin}
                disabled={joining || myStatus === "joined" || myStatus === "requested"}
                style={{ flex: 1 }}
              >
                {myStatus === "joined"
                  ? "Joined"
                  : myStatus === "requested"
                  ? "Requested"
                  : ride.join_mode === "express"
                  ? "Join"
                  : "Ask to join"}
              </Button>
            )}

            {/* Leave Button (for non-owner participants) */}
            {!isOwner && (
              <Button
                mode="outlined"
                onPress={handleLeave}
                disabled={
                  !myStatus ||
                  myStatus === "left" ||
                  myStatus === "rejected" ||
                  myStatus === "kicked"
                }
                style={{ flex: 1 }}
              >
                Leave
              </Button>
            )}

            {/* Cancel Ride Button (for owner only) */}
            {isOwner && (
              <Button
                mode="contained"
                loading={cancelling}
                onPress={handleCancelRide}
                disabled={cancelling || ride.status === 'cancelled'}
                style={{ flex: 1 }}
              >
                {ride.status === 'cancelled' ? 'Cancelled' : 'Cancel Ride'}
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
