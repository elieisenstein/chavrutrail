import { supabase } from "./supabase";
import { setCache, getCache, getCacheAge, CACHE_KEYS } from "./cacheService";
import { isOnline } from "./network";

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null; // About Me / User description (max 500 chars)
  home_region: string | null;
  ride_type: string | null; // Comma-separated, e.g., "XC,Trail"
  skill: string | null; // "Beginner" | "Intermediate" | "Advanced"
  pace: string | null; // "Slow" | "Moderate" | "Fast"
  birth_year: number | null;
  gender: string | null; // "Male" | "Female" | null (optional)
  preferred_ride_times: string | null;
  phone_number: string | null; // E.164 format, e.g., "+9725XXXXXXXX"
};

export type ProfileUpdateInput = {
  display_name?: string;
  bio?: string;
  ride_type?: string;
  skill?: string;
  pace?: string;
  birth_year?: number | null;
  gender?: string | null;
  phone_number?: string | null;
};

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const user = userRes.user;
  if (!user) throw new Error("No authenticated user");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, home_region, ride_type, skill, pace, birth_year, gender, preferred_ride_times, phone_number")
    .eq("id", user.id)
    .maybeSingle(); // Allows 0 rows without error

  if (error) throw new Error(error.message);
  return (data ?? null) as Profile | null;
}

export async function updateMyProfile(updates: ProfileUpdateInput): Promise<void> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const user = userRes.user;
  if (!user) throw new Error("No authenticated user");

  const payload = { id: user.id, ...updates };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

/**
 * Update profile by user ID directly (used during signup when session isn't ready)
 */
export async function updateProfileById(userId: string, updates: ProfileUpdateInput): Promise<void> {
  const payload = { id: userId, ...updates };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

// Helper: Convert array of ride types to comma-separated string
export function rideTypesToString(types: string[]): string {
  return types.join(",");
}

// Helper: Convert comma-separated string to array of ride types
export function stringToRideTypes(str: string | null): string[] {
  if (!str) return [];
  return str
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Fetch profile for any user by their ID
 * Used for viewing other users' public profiles
 */
export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, home_region, ride_type, skill, pace, birth_year, gender, preferred_ride_times, phone_number")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as Profile | null;
}

/**
 * Check if a display name is available (not taken by another user)
 * Returns true if available, false if taken
 * Uses case-insensitive comparison to prevent confusion with similar names
 *
 * This function calls a Postgres function via RPC to bypass RLS policies,
 * allowing unauthenticated users to check name availability during sign-up.
 */
export async function isDisplayNameAvailable(displayName: string): Promise<boolean> {
  const trimmedName = displayName.trim();

  if (!trimmedName) return false;

  try {
    // Call the Postgres function via RPC
    const { data, error } = await supabase
      .rpc('check_display_name_available', { name: trimmedName });

    if (error) {
      console.error("Display name check error:", error);
      throw new Error(error.message);
    }

    console.log(`Checking availability for "${trimmedName}":`, {
      isAvailable: data,
    });

    return data === true; // Function returns boolean directly
  } catch (e: any) {
    console.error("Failed to check display name availability:", e);
    throw e;
  }
}

// ============ CACHED VARIANT FOR OFFLINE SUPPORT ============

export type CachedProfileResult = {
  data: Profile | null;
  fromCache: boolean;
  cacheAgeMinutes?: number;
};

/**
 * Fetch my profile with offline cache support
 * Tries network first, falls back to cache if offline/error
 */
export async function fetchMyProfileWithCache(): Promise<CachedProfileResult> {
  const online = await isOnline();

  if (online) {
    try {
      const profile = await fetchMyProfile();
      if (profile) {
        await setCache(CACHE_KEYS.profile, profile);
      }
      return { data: profile, fromCache: false };
    } catch (error) {
      console.warn("Profile fetch failed, trying cache:", error);
    }
  }

  // Try to load from cache
  const cached = await getCache<Profile>(CACHE_KEYS.profile);
  if (cached) {
    const cacheAgeMinutes = await getCacheAge(CACHE_KEYS.profile);
    return {
      data: cached.data,
      fromCache: true,
      cacheAgeMinutes: cacheAgeMinutes ?? undefined,
    };
  }

  // No cache available - return null (not signed in or never cached)
  return { data: null, fromCache: false };
}