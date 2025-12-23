import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Text, Button, TextInput } from "react-native-paper";

import { supabase } from "../lib/supabase";
import RequestOtp from "./auth/RequestOtp";
import VerifyOtp from "./auth/VerifyOtp";
import { fetchMyProfile, updateMyDisplayName, Profile } from "../lib/profile";

type Stage = "request" | "verify" | "signedin";

export default function Home() {
  const [stage, setStage] = useState<Stage>("request");
  const [phone, setPhone] = useState<string>("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [nameDraft, setNameDraft] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // --- Auth session bootstrap + listener ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStage("signedin");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStage(session ? "signedin" : "request");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // --- Profile load ---
  const loadProfile = async () => {
    setErr(null);
    setLoadingProfile(true);
    try {
      const p = await fetchMyProfile();
      setProfile(p);
      setNameDraft(p.display_name ?? "");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load profile whenever we enter signed-in stage
  useEffect(() => {
    if (stage === "signedin") {
      loadProfile();
    } else {
      // reset local state when not signed in
      setProfile(null);
      setNameDraft("");
      setErr(null);
      setSaving(false);
      setLoadingProfile(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    setErr(null);
    setSaving(true);
    try {
      await updateMyDisplayName(trimmed);
      await loadProfile();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // --- Stage routing ---
  if (stage === "request") {
    return (
      <RequestOtp
        onSent={(p) => {
          setPhone(p);
          setStage("verify");
        }}
      />
    );
  }

  if (stage === "verify") {
    return <VerifyOtp phone={phone} onDone={() => setStage("signedin")} />;
  }

  // --- Signed-in UI ---
  return (
    <View style={{ padding: 16, gap: 12, marginTop: 80 }}>
      <Text variant="headlineSmall">מחובר</Text>

      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="outlined" onPress={loadProfile} loading={loadingProfile} disabled={loadingProfile}>
        רענן פרופיל
      </Button>

      <Text style={{ opacity: 0.8 }}>שם תצוגה</Text>
      <TextInput
        label="שם תצוגה"
        value={nameDraft}
        onChangeText={setNameDraft}
        autoCapitalize="words"
      />

      <Button mode="contained" onPress={saveName} loading={saving} disabled={saving}>
        שמור
      </Button>

      <Text style={{ opacity: 0.7 }}>
        profile id: {profile?.id ?? (loadingProfile ? "loading..." : "not loaded")}
      </Text>

      <Button mode="outlined" onPress={() => supabase.auth.signOut()}>
        התנתק
      </Button>
    </View>
  );
}
