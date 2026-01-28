import React, { useMemo, useState, useEffect } from "react";
import { View, I18nManager, Alert } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { supabase } from "../../../lib/supabase";
import { createRide } from "../../../lib/rides";
import { fetchMyProfile, updateMyProfile } from "../../../lib/profile";
import PhoneInputModal from "../../../components/PhoneInputModal";
import { CreateRideDraft, draftIsStepValid } from "./createRideTypes";

import StepWhen from "./steps/StepWhen";
import StepWhere from "./steps/StepWhere";
import StepDetails from "./steps/StepDetails";
import StepGroup from "./steps/StepGroup";
import StepReview from "./steps/StepReview";

type StepKey = "when" | "where" | "details" | "group" | "review";

function getInitialDraft(): CreateRideDraft {
  const defaultDate = new Date();
  defaultDate.setHours(defaultDate.getHours() + 1, 0, 0, 0);
  
  return {
    join_mode: "express",
    max_participants: 4,
    gender_preference: "all",
    pace: null,
    notes: null,
    distance_km: null,
    elevation_m: null,
    start_name: null,
    start_at: defaultDate.toISOString(),
    duration_hours: 2,
    whatsapp_link: null,
    gpx_file_uri: null,
    gpx_file_name: null,
    gpx_coordinates: null,
  };
}

export default function CreateRideWizard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const steps: { key: StepKey; title: string }[] = useMemo(
    () => [
      { key: "when", title: t("createRide.steps.when") },
      { key: "where", title: t("createRide.steps.where") },
      { key: "details", title: t("createRide.steps.details") },
      { key: "group", title: t("createRide.steps.group") },
      { key: "review", title: t("createRide.steps.review") },
    ],
    [t]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<CreateRideDraft>(getInitialDraft());
  const [submitting, setSubmitting] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const canGoNext = draftIsStepValid(stepIndex, draft);

  const stepTitle = steps[stepIndex]?.title ?? "";

  useFocusEffect(
    React.useCallback(() => {
      setStepIndex(0);
      setDraft(getInitialDraft());
    }, [])
  );

  function updateDraft(patch: Partial<CreateRideDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function doPublish() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      Alert.alert(t("common.error"), t("createRide.validation.notSignedIn"));
      return;
    }

    setSubmitting(true);
    try {
      // Upload GPX file to Supabase Storage if attached
      let gpxUrl: string | null = null;
      const gpxCoordinates = draft.gpx_coordinates ?? null;

      if (draft.gpx_file_uri) {
        const id = Math.random().toString(36).substring(2, 12);
        const fileName = `rides/${Date.now()}_${id}.gpx`;
        const response = await fetch(draft.gpx_file_uri);
        const textContent = await response.text();
        const bytes = new TextEncoder().encode(textContent);

        const { error: uploadError } = await supabase.storage
          .from("gpx-files")
          .upload(fileName, bytes, {
            contentType: "application/gpx+xml",
            upsert: false,
          });

        if (uploadError) {
          console.error("GPX upload error:", uploadError);
          Alert.alert(t("common.error"), t("createRide.where.gpxUploadFailed"));
          setSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from("gpx-files")
          .getPublicUrl(fileName);
        gpxUrl = urlData.publicUrl;
      }

      const ride = await createRide({
        owner_id: userId,
        status: "published",
        start_at: draft.start_at!,
        duration_hours: draft.duration_hours!,
        start_lat: draft.start_lat!,
        start_lng: draft.start_lng!,
        start_name: draft.start_name!,
        ride_type: draft.ride_type!,
        skill_level: draft.skill_level!,
        pace: draft.pace ?? null,
        distance_km: draft.distance_km ?? null,
        elevation_m: draft.elevation_m ?? null,
        join_mode: draft.join_mode!,
        max_participants: draft.max_participants!,
        gender_preference: draft.gender_preference ?? "all",
        notes: draft.notes ?? null,
        whatsapp_link: draft.whatsapp_link ?? null,
        gpx_url: gpxUrl,
        gpx_coordinates: gpxCoordinates,
      });

      // Auto-add ride type to user's profile if not already there
      try {
        const profile = await fetchMyProfile();
        if (profile && profile.ride_type) {
          const currentTypes = profile.ride_type.split(',').map(t => t.trim());
          const newType = draft.ride_type!;

          if (!currentTypes.includes(newType)) {
            const updatedTypes = [...currentTypes, newType];
            await updateMyProfile({
              ride_type: updatedTypes.join(','),
            });
            console.log(`Auto-added ${newType} to user's ride types`);
          }
        }
      } catch (e) {
        console.log("Failed to auto-update profile ride types:", e);
      }

      setDraft(getInitialDraft());
      setStepIndex(0);

      console.log("Ride created:", ride.id);

      navigation.navigate("MyRidesStack", {
        screen: "RideDetails",
        params: { rideId: ride.id }
      });

    } finally {
      setSubmitting(false);
    }
  }

  async function onPublish() {
    const requiredOk =
      draftIsStepValid(0, draft) &&
      draftIsStepValid(1, draft) &&
      draftIsStepValid(2, draft) &&
      draftIsStepValid(3, draft);

    if (!requiredOk) {
      for (let i = 0; i < 4; i++) {
        if (!draftIsStepValid(i, draft)) {
          setStepIndex(i);
          return;
        }
      }
      return;
    }

    // Check if user has a phone number before publishing
    try {
      const profile = await fetchMyProfile();
      if (!profile?.phone_number) {
        setPhoneModalVisible(true);
        return;
      }
    } catch (e) {
      console.log("Phone check failed:", e);
    }

    await doPublish();
  }

  async function handlePhoneSave(phoneNumber: string) {
    try {
      await updateMyProfile({ phone_number: phoneNumber });
    } catch (e) {
      console.log("Failed to save phone:", e);
    }
    setPhoneModalVisible(false);
    await doPublish();
  }


  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
        {stepTitle}
      </Text>

      <Text style={{ color: theme.colors.onBackground, opacity: 0.7, marginTop: 4 }}>
        {t("createRide.stepCounter", { current: stepIndex + 1, total: steps.length })}
      </Text>
      <Divider style={{ marginVertical: 12 }} />

      {/* Step body */}
      <View style={{ flex: 1 }}>
        {stepIndex === 0 && <StepWhen draft={draft} onChange={updateDraft} />}
        {stepIndex === 1 && <StepWhere draft={draft} onChange={updateDraft} />}
        {stepIndex === 2 && <StepDetails draft={draft} onChange={updateDraft} />}
        {stepIndex === 3 && <StepGroup draft={draft} onChange={updateDraft} />}
        {stepIndex === 4 && <StepReview draft={draft} onChange={updateDraft} />}
      </View>

      <Divider style={{ marginVertical: 12 }} />

      {/* Navigation buttons */}
      <View style={{ flexDirection: I18nManager.isRTL ? "row-reverse" : "row", gap: 12 }}>
        <Button
          mode="outlined"
          disabled={stepIndex === 0 || submitting}
          onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
          style={{ flex: 1 }}
        >
          {t("createRide.navigation.back")}
        </Button>

        {stepIndex < steps.length - 1 ? (
          <Button
            mode="contained"
            disabled={!canGoNext || submitting}
            onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            style={{ flex: 1 }}
          >
            {t("createRide.navigation.next")}
          </Button>
        ) : (
          <Button 
            mode="contained" 
            disabled={submitting} 
            loading={submitting} 
            onPress={onPublish} 
            style={{ flex: 1 }}
          >
            {t("createRide.navigation.publish")}
          </Button>
        )}
      </View>

      <PhoneInputModal
        visible={phoneModalVisible}
        onClose={() => setPhoneModalVisible(false)}
        onSave={handlePhoneSave}
        message={t('phoneModal.messageOrganizer')}
      />
    </View>
  );
}
