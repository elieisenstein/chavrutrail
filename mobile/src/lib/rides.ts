// src/lib/rides.ts
import { supabase } from "./supabase";

export type RideStatus = "draft" | "published" | "cancelled" | "completed";
export type JoinMode = "express" | "approval";
export type ParticipantRole = "owner" | "participant";
export type ParticipantStatus = "joined" | "requested" | "rejected" | "left" | "kicked";

export type Ride = {
  id: string;
  owner_id: string;
  status: RideStatus;

  start_at: string; // timestamptz ISO
  start_lat: number;
  start_lng: number;
  start_name: string | null;

  ride_type: string;
  skill_level: string;
  pace: string | null;

  distance_km: number | null;
  elevation_m: number | null;

  join_mode: JoinMode;
  max_participants: number;

  notes: string | null;

  created_at: string;
  updated_at: string;
};

export type CreateRideInput = Omit<
  Ride,
  "id" | "created_at" | "updated_at"
>;

export type RideParticipant = {
  ride_id: string;
  user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  created_at: string;
};

export async function createRide(input: CreateRideInput): Promise<Ride> {
  const { data, error } = await supabase
    .from("rides")
    .insert(input)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Ride;
}

export async function listPublishedUpcomingRides(limit = 50): Promise<Ride[]> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "published")
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Ride[];
}

/**
 * Join logic:
 * - express: insert participant status=joined
 * - approval: insert participant status=requested
 */
export async function joinOrRequestRide(rideId: string, joinMode: JoinMode): Promise<void> {
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message);
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const status: ParticipantStatus = joinMode === "express" ? "joined" : "requested";

  const { error } = await supabase
    .from("ride_participants")
    .upsert(
      { ride_id: rideId, user_id: userId, role: "participant", status },
      { onConflict: "ride_id,user_id" }
    );

  if (error) throw new Error(error.message);
}

export async function leaveRide(rideId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const { error } = await supabase
    .from("ride_participants")
    .update({ status: "left" })
    .eq("ride_id", rideId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getMyRideParticipantStatus(
  rideId: string
): Promise<ParticipantStatus | null> {
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message);
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("ride_participants")
    .select("status")
    .eq("ride_id", rideId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.status as ParticipantStatus) ?? null;
}

export async function getRideParticipantCount(rideId: string): Promise<number> {
  const { count, error } = await supabase
    .from("ride_participants")
    .select("*", { count: "exact", head: true })
    .eq("ride_id", rideId)
    .eq("status", "joined");

  if (error) throw new Error(error.message);
  return count ?? 0;
}
