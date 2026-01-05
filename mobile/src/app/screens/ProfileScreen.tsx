import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Button, TextInput, Chip, useTheme, Divider } from "react-native-paper";
import { supabase } from "../../lib/supabase";
import {
  fetchMyProfile,
  updateMyProfile,
  Profile,
  rideTypesToString,
  stringToRideTypes
} from "../../lib/profile";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

const RIDE_TYPES = ["XC", "Trail", "Enduro", "Gravel", "Road"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PACE_OPTIONS = ["Slow", "Moderate", "Fast"];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [selectedRideTypes, setSelectedRideTypes] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedPace, setSelectedPace] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string | null>(null);

  const nav = useNavigation<any>();
  const theme = useTheme();

  const loadProfile = async () => {
    setErr(null);
    setLoading(true);
    try {
      const p = await fetchMyProfile();

      if (!p) {
        setProfile(null);
        setDisplayName("");
        setBio("");
        setSelectedRideTypes([]);
        setSelectedSkill(null);
        setSelectedPace(null);
        setBirthYear("");
        setSelectedGender(null);
        return;
      }

      setProfile(p);
      setDisplayName(p.display_name ?? "");
      setBio(p.bio ?? "");
      setSelectedRideTypes(stringToRideTypes(p.ride_type));
      setSelectedSkill(p.skill);
      setSelectedPace(p.pace);
      setBirthYear(p.birth_year ? String(p.birth_year) : "");
      setSelectedGender(p.gender);
    } catch (e: any) {
      setErr(e?.message ?? t("profile.loadingProfile"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveProfile = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updates = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        ride_type: selectedRideTypes.length > 0 ? rideTypesToString(selectedRideTypes) : null,
        skill: selectedSkill,
        pace: selectedPace,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        gender: selectedGender,
      };

      await updateMyProfile(updates as any);
      await loadProfile();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const toggleRideType = (type: string) => {
    if (selectedRideTypes.includes(type)) {
      setSelectedRideTypes(selectedRideTypes.filter(t => t !== type));
    } else {
      setSelectedRideTypes([...selectedRideTypes, type]);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
        <Text>{t("profile.loadingProfile")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {!!err ? (
        <Text style={{ color: theme.colors.error, marginBottom: 12 }}>
          {err}
        </Text>
      ) : null}

      {/* Settings Button */}
      <Button
        mode="outlined"
        onPress={() => nav.navigate("Settings")}
        style={{ marginBottom: 16 }}
      >
        {t("settings.title")}
      </Button>

      <Text variant="headlineSmall" style={{ marginBottom: 16 }}>
        {t("profile.title")}
      </Text>

      {/* Display Name */}
      <TextInput
        label={t("profile.displayName")}
        value={displayName}
        onChangeText={setDisplayName}
        style={{ marginBottom: 16 }}
      />

      {/* About Me */}
      <TextInput
        label={t("profile.aboutMe")}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        maxLength={500}
        placeholder={t("profile.aboutMePlaceholder")}
        style={{ marginBottom: 8 }}
      />
      <Text style={{ opacity: 0.6, fontSize: 12, marginBottom: 16, textAlign: 'right' }}>
        {bio.length}/500
      </Text>

      <Divider style={{ marginBottom: 16 }} />

      {/* Ride Types */}
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        {t("profile.rideTypes")}
      </Text>
      <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12 }}>
        {t("profile.rideTypesHelp")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {RIDE_TYPES.map(type => (
          <Chip
            key={type}
            selected={selectedRideTypes.includes(type)}
            onPress={() => toggleRideType(type)}
            mode={selectedRideTypes.includes(type) ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: selectedRideTypes.includes(type)
                ? (type === "Road" ? "#2196F3" : theme.colors.primary)
                : 'transparent',
              borderColor: type === "Road" && !selectedRideTypes.includes(type)
                ? "#2196F3"
                : undefined
            }}
            textStyle={{
              color: selectedRideTypes.includes(type)
                ? (type === "Road" ? "#FFFFFF" : theme.colors.onPrimary)
                : (type === "Road" ? "#2196F3" : theme.colors.onSurface)
            }}
          >
            {t(`rideTypes.${type}`)}
          </Chip>
        ))}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Skill Level */}
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        {t("profile.skillLevel")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {SKILL_LEVELS.map(level => (
          <Chip
            key={level}
            selected={selectedSkill === level}
            onPress={() => setSelectedSkill(level)}
            mode={selectedSkill === level ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: selectedSkill === level
                ? theme.colors.primary
                : 'transparent'
            }}
            textStyle={{
              color: selectedSkill === level
                ? theme.colors.onPrimary
                : theme.colors.onSurface
            }}
          >
            {t(`skillLevels.${level}`)}
          </Chip>
        ))}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Pace */}
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        {t("profile.pace")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {PACE_OPTIONS.map(pace => (
          <Chip
            key={pace}
            selected={selectedPace === pace}
            onPress={() => setSelectedPace(pace)}
            mode={selectedPace === pace ? "flat" : "outlined"}
            showSelectedCheck={false}
            style={{
              backgroundColor: selectedPace === pace
                ? theme.colors.primary
                : 'transparent'
            }}
            textStyle={{
              color: selectedPace === pace
                ? theme.colors.onPrimary
                : theme.colors.onSurface
            }}
          >
            {t(`paceOptions.${pace}`)}
          </Chip>
        ))}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Birth Year */}
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        {t("profile.birthYear")}
      </Text>
      <TextInput
        label={t("profile.birthYearPlaceholder")}
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="numeric"
        maxLength={4}
        style={{ marginBottom: 16 }}
      />

      <Divider style={{ marginBottom: 16 }} />

      {/* Gender */}
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        {t("profile.gender")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Chip
          selected={selectedGender === "Male"}
          onPress={() => setSelectedGender("Male")}
          mode={selectedGender === "Male" ? "flat" : "outlined"}
          showSelectedCheck={false}
          style={{
            backgroundColor: selectedGender === "Male"
              ? theme.colors.primary
              : 'transparent'
          }}
          textStyle={{
            color: selectedGender === "Male"
              ? theme.colors.onPrimary
              : theme.colors.onSurface
          }}
        >
          {t("profile.genderOptions.male")}
        </Chip>
        <Chip
          selected={selectedGender === "Female"}
          onPress={() => setSelectedGender("Female")}
          mode={selectedGender === "Female" ? "flat" : "outlined"}
          showSelectedCheck={false}
          style={{
            backgroundColor: selectedGender === "Female"
              ? theme.colors.primary
              : 'transparent'
          }}
          textStyle={{
            color: selectedGender === "Female"
              ? theme.colors.onPrimary
              : theme.colors.onSurface
          }}
        >
          {t("profile.genderOptions.female")}
        </Chip>
        <Chip
          selected={selectedGender === null}
          onPress={() => setSelectedGender(null)}
          mode={selectedGender === null ? "flat" : "outlined"}
          showSelectedCheck={false}
          style={{
            backgroundColor: selectedGender === null
              ? theme.colors.primary
              : 'transparent'
          }}
          textStyle={{
            color: selectedGender === null
              ? theme.colors.onPrimary
              : theme.colors.onSurface
          }}
        >
          {t("profile.genderOptions.other")}
        </Chip>
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Save Button */}
      <Button
        mode="contained"
        onPress={saveProfile}
        loading={saving}
        disabled={saving || !displayName.trim()}
        style={{ marginBottom: 12 }}
      >
        {t("profile.saveProfile")}
      </Button>

      {/* Sign Out */}
      <Button mode="outlined" onPress={() => supabase.auth.signOut()}>
        {t("common.signOut")}
      </Button>
    </ScrollView>
  );
}