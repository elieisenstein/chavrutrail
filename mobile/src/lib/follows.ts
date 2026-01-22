import { supabase } from "./supabase";

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowWithProfile = {
  id: string;
  following_id: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string | null;
  };
};

/**
 * Follow a user
 */
export async function followUser(userId: string): Promise<void> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const currentUserId = userRes.user?.id;
  if (!currentUserId) throw new Error("No authenticated user");

  if (currentUserId === userId) {
    throw new Error("Cannot follow yourself");
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: currentUserId, following_id: userId });

  if (error) throw new Error(error.message);
}

/**
 * Unfollow a user
 */
export async function unfollowUser(userId: string): Promise<void> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const currentUserId = userRes.user?.id;
  if (!currentUserId) throw new Error("No authenticated user");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", userId);

  if (error) throw new Error(error.message);
}

/**
 * Check if current user follows the given user
 */
export async function isFollowing(userId: string): Promise<boolean> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const currentUserId = userRes.user?.id;
  if (!currentUserId) return false;

  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data !== null;
}

/**
 * Get list of users the current user follows (with profile data)
 */
export async function getFollowingList(): Promise<FollowWithProfile[]> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const currentUserId = userRes.user?.id;
  if (!currentUserId) return [];

  const { data, error } = await supabase
    .from("follows")
    .select(`
      id,
      following_id,
      created_at,
      profile:profiles!follows_following_id_fkey(id, display_name)
    `)
    .eq("follower_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Transform the data to match our type
  return (data || []).map((item: any) => ({
    id: item.id,
    following_id: item.following_id,
    created_at: item.created_at,
    profile: item.profile,
  }));
}

/**
 * Get the count of users following a specific user
 */
export async function getFollowersCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  if (error) throw new Error(error.message);
  return count || 0;
}

/**
 * Get the count of users the current user is following
 */
export async function getFollowingCount(): Promise<number> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const currentUserId = userRes.user?.id;
  if (!currentUserId) return 0;

  const { count, error } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", currentUserId);

  if (error) throw new Error(error.message);
  return count || 0;
}
