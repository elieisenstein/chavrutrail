import React, { useCallback, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Button, TextInput, Chip, useTheme, Divider } from "react-native-paper";
import { supabase } from "../../lib/supabase";
import {
  fetchMyProfile,
  updateMyProfile,
  Profile,
  rideTypesToString,
  stringToRideTypes,
} from "../../lib/profile";
import { validateIsraeliPhone } from "../../components/PhoneInputModal";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

// const RIDE_TYPES = ["XC", "Trail", "Enduro", "Gravel", "Road"];
const RIDE_TYPES = ["Trail", "Enduro", "Gravel", "Road"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const PACE_OPTIONS = ["Slow", "Moderate", "Fast"];

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
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
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");

  const nav = useNavigation<any>();
  const theme = useTheme();

  // Language-based direction
  const isRTL = i18n.language === "he";

  // Display order: reverse the DATA (robust), do NOT use row-reverse with wrap
  const rideTypesDisplay = isRTL ? [...RIDE_TYPES].reverse() : RIDE_TYPES;
  const skillLevelsDisplay = isRTL ? [...SKILL_LEVELS].reverse() : SKILL_LEVELS;
  const paceOptionsDisplay = isRTL ? [...PACE_OPTIONS].reverse() : PACE_OPTIONS;

  const genderOptionsDisplay = isRTL
    ? [
      { key: "Other", value: null as any, label: t("profile.genderOptions.other") },
      { key: "Female", value: "Female" as any, label: t("profile.genderOptions.female") },
      { key: "Male", value: "Male" as any, label: t("profile.genderOptions.male") },
    ]
    : [
      { key: "Male", value: "Male" as any, label: t("profile.genderOptions.male") },
      { key: "Female", value: "Female" as any, label: t("profile.genderOptions.female") },
      { key: "Other", value: null as any, label: t("profile.genderOptions.other") },
    ];

  const dirText = {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  } as const;

  // Reusable helper: enforce chip label direction
  const chipTextDir = {
    writingDirection: isRTL ? "rtl" : "ltr",
    textAlign: "center" as const,
  };

  // Common row style for chips
  const chipRowStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: 16,
    justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
  };

  const loadProfile = async (showLoading = true) => {
    setErr(null);
    if (showLoading) setLoading(true);
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
        setPhoneNumber("");
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
      setPhoneNumber(p.phone_number ?? "");
    } catch (e: any) {
      setErr(e?.message ?? t("profile.loadingProfile"));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const isFirstLoad = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        loadProfile(true);
      } else {
        loadProfile(false);
      }
    }, [])
  );

  const saveProfile = async () => {
    setErr(null);
    setPhoneError("");
    setSaving(true);
    try {
      // Validate phone if provided
      let normalizedPhone: string | null = null;
      if (phoneNumber.trim()) {
        const validated = validateIsraeliPhone(phoneNumber);
        if (!validated) {
          setPhoneError(t("profile.invalidPhone"));
          setSaving(false);
          return;
        }
        normalizedPhone = validated;
      }

      const updates = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        ride_type: selectedRideTypes.length > 0 ? rideTypesToString(selectedRideTypes) : null,
        skill: selectedSkill,
        pace: selectedPace,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        gender: selectedGender,
        phone_number: normalizedPhone,
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
      setSelectedRideTypes(selectedRideTypes.filter((t0) => t0 !== type));
    } else {
      setSelectedRideTypes([...selectedRideTypes, type]);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
        <Text style={dirText}>{t("profile.loadingProfile")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      {!!err ? (
        <Text style={{ color: theme.colors.error, marginBottom: 12, ...dirText }}>{err}</Text>
      ) : null}

      {/* Settings & Following Buttons */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
        <Button mode="outlined" onPress={() => nav.navigate("Settings")} style={{ flex: 1 }}>
          {t("settings.title")}
        </Button>
        <Button mode="outlined" onPress={() => nav.navigate("Following")} style={{ flex: 1 }}>
          {t("followingScreen.title")}
        </Button>
      </View>

      {/* Display Name */}
      <TextInput
        label={t("profile.displayName")}
        value={displayName}
        onChangeText={setDisplayName}
        style={{ marginBottom: 16 }}
        contentStyle={dirText}
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
        contentStyle={dirText}
      />
      <Text style={{ opacity: 0.6, fontSize: 12, marginBottom: 16, ...dirText }}>
        {bio.length}/500
      </Text>

      {/* Phone Number */}
      <TextInput
        label={t("profile.phoneNumber")}
        placeholder={t("profile.phoneNumberPlaceholder")}
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          if (phoneError) setPhoneError("");
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        error={!!phoneError}
        style={{ marginBottom: 4 }}
        contentStyle={dirText}
      />
      <Text style={{ opacity: 0.6, fontSize: 12, marginBottom: phoneError ? 4 : 16, ...dirText }}>
        {t("profile.phoneNumberHelp")}
      </Text>
      {phoneError ? (
        <Text style={{ color: theme.colors.error, fontSize: 12, marginBottom: 16, ...dirText }}>
          {phoneError}
        </Text>
      ) : null}

      <Divider style={{ marginBottom: 16 }} />

      {/* Ride Types */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("profile.rideTypes")}
      </Text>
      <Text style={{ opacity: 0.7, marginBottom: 8, fontSize: 12, ...dirText }}>
        {t("profile.rideTypesHelp")}
      </Text>

      <View style={chipRowStyle}>
        {rideTypesDisplay.map((type) => {
          const isSelected = selectedRideTypes.includes(type);
          const isRoad = type === "Road";

          return (
            <Chip
              key={type}
              selected={isSelected}
              onPress={() => toggleRideType(type)}
              mode={isSelected ? "flat" : "outlined"}
              showSelectedCheck={false}
              style={{
                backgroundColor: isSelected ? theme.colors.primary : "transparent",
              }}
              textStyle={{
                ...chipTextDir,
                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
              }}
            >
              {t(`rideTypes.${type}`)}
            </Chip>
          );
        })}
      </View>

      {selectedRideTypes.length === 0 && (
        <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: -8, marginBottom: 8, ...dirText }}>
          {t("profile.rideTypesRequired")}
        </Text>
      )}

      <Divider style={{ marginBottom: 16 }} />

      {/* Skill Level */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("profile.skillLevel")}
      </Text>

      <View style={chipRowStyle}>
        {skillLevelsDisplay.map((level) => {
          const isSelected = selectedSkill === level;

          return (
            <Chip
              key={level}
              selected={isSelected}
              onPress={() => setSelectedSkill(level)}
              mode={isSelected ? "flat" : "outlined"}
              showSelectedCheck={false}
              style={{
                backgroundColor: isSelected ? theme.colors.primary : "transparent",
              }}
              textStyle={{
                ...chipTextDir,
                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
              }}
            >
              {t(`skillLevels.${level}`)}
            </Chip>
          );
        })}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Pace */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("profile.pace")}
      </Text>

      <View style={chipRowStyle}>
        {paceOptionsDisplay.map((pace) => {
          const isSelected = selectedPace === pace;

          return (
            <Chip
              key={pace}
              selected={isSelected}
              onPress={() => setSelectedPace(pace)}
              mode={isSelected ? "flat" : "outlined"}
              showSelectedCheck={false}
              style={{
                backgroundColor: isSelected ? theme.colors.primary : "transparent",
              }}
              textStyle={{
                ...chipTextDir,
                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
              }}
            >
              {t(`paceOptions.${pace}`)}
            </Chip>
          );
        })}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Birth Year */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("profile.birthYear")}
      </Text>

      <TextInput
        placeholder={t("profile.birthYearPlaceholder")}
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="numeric"
        maxLength={4}
        style={{ marginBottom: 16 }}
        contentStyle={dirText}
      />
      <Divider style={{ marginBottom: 16 }} />

      {/* Gender */}
      <Text variant="titleMedium" style={{ marginBottom: 8, ...dirText }}>
        {t("profile.gender")}
      </Text>

      <View style={chipRowStyle}>
        {genderOptionsDisplay.map((g) => {
          const isSelected = selectedGender === g.value;

          return (
            <Chip
              key={g.key}
              selected={isSelected}
              onPress={() => setSelectedGender(g.value)}
              mode={isSelected ? "flat" : "outlined"}
              showSelectedCheck={false}
              style={{
                backgroundColor: isSelected ? theme.colors.primary : "transparent",
              }}
              textStyle={{
                ...chipTextDir,
                color: isSelected ? theme.colors.onPrimary : theme.colors.onSurface,
              }}
            >
              {g.label}
            </Chip>
          );
        })}
      </View>

      <Divider style={{ marginBottom: 16 }} />

      {/* Save Button */}
      <Button
        mode="contained"
        onPress={saveProfile}
        loading={saving}
        disabled={saving || !displayName.trim() || selectedRideTypes.length === 0}
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
