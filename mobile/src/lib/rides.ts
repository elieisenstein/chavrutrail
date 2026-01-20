// src/lib/rides.ts
import { supabase } from "./supabase";
import {
  notifyOwnerOfJoinRequest,
  notifyUserOfApproval,
  notifyUserOfRejection,
  notifyParticipantsOfCancellation,
} from './notificationHelpers';

export type RideStatus = "draft" | "published" | "cancelled" | "completed";
export type JoinMode = "express" | "approval";
export type ParticipantRole = "owner" | "participant";
export type ParticipantStatus = "joined" | "requested" | "rejected" | "left" | "kicked";

export type Ride = {
  id: string;
  owner_id: string;
  owner_display_name?: string;
  owner_rides_organized?: number;  
  owner_rides_joined?: number;    
  status: RideStatus;

  start_at: string; // timestamptz ISO
  duration_hours: number; // Ride duration in hours (1-12)
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
  gender_preference: "all" | "men" | "women";

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

/**
 * Participant with display name for showing in UI
 */
export type ParticipantWithName = {
  user_id: string;
  display_name: string;
  status: ParticipantStatus;
  role: ParticipantRole;
};

// ============ FILTER TYPES FOR M1 ============
export type RideFilters = {
  rideTypes: string[]; // e.g., ["XC", "Trail"]
  skillLevels: string[]; // e.g., ["Beginner", "Intermediate"]
  maxDays: number; // e.g., 7 for "next 7 days"
  locationRadius?: number; // kilometers, undefined = no location filter
  userLat?: number;
  userLng?: number;
};

/**
 * Configuration: How many hours after a ride ends to keep showing it
 * This allows users to see recent rides briefly after they've finished
 */
export const RIDE_VISIBILITY_HOURS_AFTER_END = 48;

/**
 * Calculate the minimum end time for ride visibility
 * Rides are visible if they ended less than RIDE_VISIBILITY_HOURS_AFTER_END ago
 * Returns ISO timestamp
 */
function getMinimumEndTime(): string {
  const now = new Date();
  now.setHours(now.getHours() - RIDE_VISIBILITY_HOURS_AFTER_END);
  return now.toISOString();
}

/**
 * Calculate ride end time based on start time and duration
 * Returns ISO timestamp
 */
function calculateRideEndTime(startAt: string, durationHours: number): Date {
  const startTime = new Date(startAt);
  startTime.setHours(startTime.getHours() + durationHours);
  return startTime;
}

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

// ============ NEW: FILTERED RIDE LISTING ============
/**
 * List rides with filters applied
 * Note: Location filtering is done client-side since we don't have PostGIS
 * Rides are visible for RIDE_VISIBILITY_HOURS_AFTER_END hours after they end
 */
export async function listFilteredRides(filters: RideFilters, userGender?: string | null, limit = 50): Promise<Ride[]> {
  const nowIso = new Date().toISOString();
  const minEndTimeIso = getMinimumEndTime();

  // Calculate max date based on maxDays (from now)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + filters.maxDays);
  const maxDateIso = maxDate.toISOString();

  // Build query - fetch rides that started recently or will start soon
  // We'll filter by end time client-side since Postgres can't compute end_time in WHERE
  let query = supabase
    .from("rides")
    .select("*, owner:profiles!rides_owner_profile_id_fkey(display_name)")
    .eq("status", "published")
    .lte("start_at", maxDateIso) // Started before max future date
    .order("start_at", { ascending: true })
    .limit(limit * 2); // Fetch more to account for filtering

  // Apply ride type filter if not all types
  if (filters.rideTypes.length > 0) {
    query = query.in("ride_type", filters.rideTypes);
  }

  // Apply skill level filter if not all levels
  if (filters.skillLevels.length > 0) {
    query = query.in("skill_level", filters.skillLevels);
  }

  // Gender filtering
  if (userGender === "Male") {
    query = query.in("gender_preference", ["all", "men"]);
  } else if (userGender === "Female") {
    query = query.in("gender_preference", ["all", "women"]);
  } else {
    query = query.eq("gender_preference", "all");
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  // Flatten the profiles join
  let rides = (data ?? []).map((item: any) => ({
    ...item,
    owner_display_name: item.owner?.display_name ?? "Unknown",
    owner: undefined,
  })) as Ride[];

  // Filter by ride end time (client-side)
  // Keep rides that ended less than RIDE_VISIBILITY_HOURS_AFTER_END ago
  rides = rides.filter(ride => {
    const endTime = calculateRideEndTime(ride.start_at, ride.duration_hours);
    return endTime >= new Date(minEndTimeIso);
  });

  // Get unique owner IDs
  const uniqueOwnerIds = [...new Set(rides.map(r => r.owner_id))];

  // Fetch counts for all owners in parallel
  const ownerStatsMap = new Map<string, { organized: number; joined: number }>();
  
  // TODO: Optimize for scale - this fetches counts for each unique owner (N queries)
  // Future improvement: Add rides_organized_count and rides_joined_count to profiles table
  // and update via automated job when rides complete

  await Promise.all(
    uniqueOwnerIds.map(async (ownerId) => {
      const [organized, joined] = await Promise.all([
        getUserOrganizedRidesCount(ownerId),
        getUserJoinedRidesCount(ownerId),
      ]);
      ownerStatsMap.set(ownerId, { organized, joined });
    })
  );

  // Attach stats to rides
  rides = rides.map(ride => ({
    ...ride,
    owner_rides_organized: ownerStatsMap.get(ride.owner_id)?.organized ?? 0,
    owner_rides_joined: ownerStatsMap.get(ride.owner_id)?.joined ?? 0,
  }));

  // Client-side location filtering (if radius specified)
  if (filters.locationRadius && filters.userLat !== undefined && filters.userLng !== undefined) {
    rides = rides.filter(ride => {
      const distance = calculateDistance(
        filters.userLat!,
        filters.userLng!,
        ride.start_lat,
        ride.start_lng
      );
      return distance <= filters.locationRadius!;
    });
  }

  // Apply final limit after all filtering
  return rides.slice(0, limit);
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
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

  // Send notification to owner if approval required
  if (joinMode === "approval") {
    // Get ride details and user profile
    const [{ data: ride }, { data: profile }] = await Promise.all([
      supabase.from("rides").select("owner_id, ride_type, skill_level").eq("id", rideId).single(),
      supabase.from("profiles").select("display_name").eq("user_id", userId).single(),
    ]);

    if (ride && profile) {
      const rideTitle = `${ride.ride_type} · ${ride.skill_level}`;
      await notifyOwnerOfJoinRequest(ride.owner_id, profile.display_name || "משתמש", rideId, rideTitle);
    }
  }
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

/**
 * Fetch all participants for a ride with their display names
 * Returns both joined and requested participants
 */
export async function getRideParticipants(rideId: string): Promise<ParticipantWithName[]> {
  const { data, error } = await supabase
    .from("ride_participants")
    .select(`
      user_id,
      status,
      role,
      profiles!inner(display_name)
    `)
    .eq("ride_id", rideId)
    .in("status", ["joined", "requested"]);

  if (error) throw new Error(error.message);

  // Transform the data to flatten the profiles join
  return (data ?? []).map((p: any) => ({
    user_id: p.user_id,
    display_name: p.profiles?.display_name ?? "Unknown",
    status: p.status as ParticipantStatus,
    role: p.role as ParticipantRole,
  }));
}

/**
 * Approve a join request (owner only)
 * Changes status from 'requested' to 'joined'
 */
export async function approveJoinRequest(rideId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("ride_participants")
    .update({ status: "joined" })
    .eq("ride_id", rideId)
    .eq("user_id", userId)
    .eq("status", "requested");

  if (error) throw new Error(error.message);

  // Notify user of approval
  const { data: ride } = await supabase
    .from("rides")
    .select("ride_type, skill_level")
    .eq("id", rideId)
    .single();

  if (ride) {
    const rideTitle = `${ride.ride_type} · ${ride.skill_level}`;
    await notifyUserOfApproval(userId, rideTitle, rideId);
  }
}
/**
 * Reject a join request (owner only)
 * Changes status from 'requested' to 'rejected'
 */
export async function rejectJoinRequest(rideId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("ride_participants")
    .update({ status: "rejected" })
    .eq("ride_id", rideId)
    .eq("user_id", userId)
    .eq("status", "requested");

  if (error) throw new Error(error.message);

  // Notify user of rejection
  const { data: ride } = await supabase
    .from("rides")
    .select("ride_type, skill_level")
    .eq("id", rideId)
    .single();

  if (ride) {
    const rideTitle = `${ride.ride_type} · ${ride.skill_level}`;
    await notifyUserOfRejection(userId, rideTitle, rideId);
  }
}
/**
 * Cancel a ride (owner only)
 * Changes ride status to 'cancelled' - ride won't appear in feed anymore
 */
export async function cancelRide(rideId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const { error } = await supabase
    .from("rides")
    .update({ status: "cancelled" })
    .eq("id", rideId)
    .eq("owner_id", userId);

  if (error) throw new Error(error.message);

  // Notify all joined participants
  const { data: ride } = await supabase
    .from("rides")
    .select("ride_type, skill_level")
    .eq("id", rideId)
    .single();

  const { data: participants } = await supabase
    .from("ride_participants")
    .select("user_id")
    .eq("ride_id", rideId)
    .eq("status", "joined")
    .neq("user_id", userId); // Don't notify the owner

  if (ride && participants && participants.length > 0) {
    const rideTitle = `${ride.ride_type} · ${ride.skill_level}`;
    const participantIds = participants.map(p => p.user_id);
    await notifyParticipantsOfCancellation(participantIds, rideTitle, rideId);
  }
}

/**
 * Get rides I'm organizing (owner)
 * Shows rides for RIDE_VISIBILITY_HOURS_AFTER_END hours after they end
 */
export async function getMyOrganizingRides(): Promise<Ride[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const minEndTimeIso = getMinimumEndTime();

  const { data, error } = await supabase
    .from("rides")
    .select("*, owner:profiles!rides_owner_profile_id_fkey(display_name)")
    .eq("owner_id", userId)
    .eq("status", "published")
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);

  let rides = (data ?? []).map((item: any) => ({
    ...item,
    owner_display_name: item.owner?.display_name ?? "Unknown",
    owner: undefined,
  })) as Ride[];

  // Filter by ride end time (client-side)
  // Keep rides that ended less than RIDE_VISIBILITY_HOURS_AFTER_END ago
  rides = rides.filter(ride => {
    const endTime = calculateRideEndTime(ride.start_at, ride.duration_hours);
    return endTime >= new Date(minEndTimeIso);
  });

  return rides;
}

/**
 * Get rides I've joined (as participant, NOT owner)
 * Shows rides for RIDE_VISIBILITY_HOURS_AFTER_END hours after they end
 */
export async function getMyJoinedRides(): Promise<Ride[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const minEndTimeIso = getMinimumEndTime();

  const { data, error } = await supabase
    .from("rides")
    .select(`
      *,
      owner:profiles!rides_owner_profile_id_fkey(display_name),
      ride_participants!inner(user_id, status)
    `)
    .eq("ride_participants.user_id", userId)
    .eq("ride_participants.status", "joined")
    .neq("owner_id", userId)
    .eq("status", "published")
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);

  let rides = (data ?? []).map((item: any) => {
    const { ride_participants, owner, ...ride } = item;
    return {
      ...ride,
      owner_display_name: owner?.display_name ?? "Unknown",
    } as Ride;
  });

  // Filter by ride end time (client-side)
  // Keep rides that ended less than RIDE_VISIBILITY_HOURS_AFTER_END ago
  rides = rides.filter(ride => {
    const endTime = calculateRideEndTime(ride.start_at, ride.duration_hours);
    return endTime >= new Date(minEndTimeIso);
  });

  return rides;
}

/**
 * Get rides I've requested to join (waiting approval, NOT owner)
 * Shows rides for RIDE_VISIBILITY_HOURS_AFTER_END hours after they end
 */
export async function getMyRequestedRides(): Promise<Ride[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in");

  const minEndTimeIso = getMinimumEndTime();

  const { data, error } = await supabase
    .from("rides")
    .select(`
      *,
      owner:profiles!rides_owner_profile_id_fkey(display_name),
      ride_participants!inner(user_id, status)
    `)
    .eq("ride_participants.user_id", userId)
    .eq("ride_participants.status", "requested")
    .neq("owner_id", userId)
    .eq("status", "published")
    .order("start_at", { ascending: true });

  if (error) throw new Error(error.message);

  let rides = (data ?? []).map((item: any) => {
    const { ride_participants, owner, ...ride } = item;
    return {
      ...ride,
      owner_display_name: owner?.display_name ?? "Unknown",
    } as Ride;
  });

  // Filter by ride end time (client-side)
  // Keep rides that ended less than RIDE_VISIBILITY_HOURS_AFTER_END ago
  rides = rides.filter(ride => {
    const endTime = calculateRideEndTime(ride.start_at, ride.duration_hours);
    return endTime >= new Date(minEndTimeIso);
  });

  return rides;
}

/**
 * Count how many rides a user has organized (completed, not cancelled)
 */
export async function getUserOrganizedRidesCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("rides")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId)
    .lt("start_at", new Date().toISOString()) // Past rides
    .neq("status", "cancelled");

  if (error) {
    console.log("Error counting organized rides:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Count how many rides a user has joined (completed, not cancelled)
 */
export async function getUserJoinedRidesCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("ride_participants")
    .select("ride_id, rides!inner(start_at, status, owner_id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "joined")
    .lt("rides.start_at", new Date().toISOString()) // Past rides
    .neq("rides.status", "cancelled")
    .neq("rides.owner_id", userId); // Don't count rides where they're the owner

  if (error) {
    console.log("Error counting joined rides:", error.message);
    return 0;
  }
  return count ?? 0;
}