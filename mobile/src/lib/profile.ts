import { supabase } from "./supabase";

export type Profile = {
  id: string;
  display_name: string | null;
  home_region: string | null;
  preferred_ride_times: string | null;
};

export async function fetchMyProfile(): Promise<Profile> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const user = userRes.user;
  if (!user) throw new Error("No authenticated user");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, home_region, preferred_ride_times")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function updateMyDisplayName(displayName: string): Promise<void> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const user = userRes.user;
  if (!user) throw new Error("No authenticated user");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}
