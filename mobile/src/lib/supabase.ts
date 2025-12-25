import { createClient } from "@supabase/supabase-js";

// Production credentials - hardcoded for build
const url = "https://qurojlswvvceqmyjkmeh.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cm9qbHN3dnZjZXFteWprbWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0Nzc1MjIsImV4cCI6MjA4MjA1MzUyMn0.mnxG79DhXX52QPud-HJGFbtR1zMAwWfkpwWq4cxiq_w";

if (!url || !anon) {
  throw new Error("Missing Supabase credentials");
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});