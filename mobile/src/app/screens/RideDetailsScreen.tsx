import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { RouteProp, useRoute } from "@react-navigation/native";

import { formatDateTimeLocal } from "../../lib/datetime";
import { supabase } from "../../lib/supabase";
import type { Ride } from "../../lib/rides";
import type { FeedStackParamList } from "../navigation/AppNavigator";
import { Button, Snackbar } from "react-native-paper";
import { joinOrRequestRide, leaveRide, getMyRideParticipantStatus, getRideParticipantCount } from "../../lib/rides";
import type { ParticipantStatus } from "../../lib/rides";



type RideDetailsRoute = RouteProp<FeedStackParamList, "RideDetails">;

export default function RideDetailsScreen() {
  const route = useRoute<RideDetailsRoute>();
  const { rideId } = route.params;

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<ParticipantStatus | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);


  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("id", rideId)
          .single();

        if (error) throw new Error(error.message);
        if (mounted) setRide(data as Ride);
        
        const [status, count] = await Promise.all([
            getMyRideParticipantStatus(rideId),
            getRideParticipantCount(rideId),
        ]);

        if (mounted) {
            setMyStatus(status);
            setJoinedCount(count);
        }
      } catch (e: any) {
        console.log("RideDetails load error:", e?.message ?? e);
        if (mounted) setRide(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [rideId]);

  useEffect(() => {
  let mounted = true;

  (async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (error) throw new Error(error.message);
      if (mounted) setRide(data as Ride);

      const [status, count] = await Promise.all([
        getMyRideParticipantStatus(rideId),
        getRideParticipantCount(rideId),
      ]);

      if (mounted) {
        setMyStatus(status);
        setJoinedCount(count);
      }
    } catch (e: any) {
      console.log("RideDetails load error:", e?.message ?? e);
      if (mounted) setRide(null);
    } finally {
      if (mounted) setLoading(false);
    }
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

    const [status, count] = await Promise.all([
      getMyRideParticipantStatus(ride.id),
      getRideParticipantCount(ride.id),
    ]);

    setMyStatus(status);
    setJoinedCount(count);
    
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

    const [status, count] = await Promise.all([
      getMyRideParticipantStatus(ride.id),
      getRideParticipantCount(ride.id),
    ]);

    setMyStatus(status);
    setJoinedCount(count);

  } catch (e: any) {
    console.log("Leave error:", e?.message ?? e);
  }
}

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Ride not found (or you don’t have permission).</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Card>
        <Card.Content style={{ gap: 8 }}>
          <Text variant="titleLarge">
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

          {ride.notes ? <Text>{ride.notes}</Text> : null}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>

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
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
