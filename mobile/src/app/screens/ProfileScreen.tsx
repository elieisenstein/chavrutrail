import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Text, Button, TextInput } from "react-native-paper";

import { supabase } from "../../lib/supabase";
import { fetchMyProfile, updateMyDisplayName, Profile } from "../../lib/profile";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "react-native-paper";




export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nameDraft, setNameDraft] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const theme = useTheme();

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

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        gap: 12,
        backgroundColor: theme.colors.background,
      }}
    >


      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="outlined" onPress={() => nav.navigate("Settings")}>
        {t("settings.title")}
      </Button>
      

<TextInput
  label={t("common.displayName")}
  value={nameDraft}
  onChangeText={setNameDraft}
/>

<Button mode="contained" onPress={saveName} loading={saving} disabled={saving}>
  {t("common.save")}
</Button>

<Button mode="outlined" onPress={() => supabase.auth.signOut()}>
  {t("common.signOut")}
</Button>

    </View>
  );
}
