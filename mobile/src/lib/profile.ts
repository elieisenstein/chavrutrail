import { supabase } from "./supabase";

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
};

export type ProfileUpdateInput = {
  display_name?: string;
  bio?: string;
  ride_type?: string;
  skill?: string;
  pace?: string;
  birth_year?: number | null;
  gender?: string | null;
};

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const user = userRes.user;
  if (!user) throw new Error("No authenticated user");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, home_region, ride_type, skill, pace, birth_year, gender, preferred_ride_times")
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