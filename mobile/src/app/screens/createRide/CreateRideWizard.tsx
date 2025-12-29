import React, { useMemo, useState, useEffect } from "react";
import { View, I18nManager } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "../../../lib/supabase";
import { createRide } from "../../../lib/rides";
import { CreateRideDraft, draftIsStepValid } from "./createRideTypes";

import StepWhen from "./steps/StepWhen";
import StepWhere from "./steps/StepWhere";
import StepDetails from "./steps/StepDetails";
import StepGroup from "./steps/StepGroup";
import StepReview from "./steps/StepReview";

type StepKey = "when" | "where" | "details" | "group" | "review";

function getInitialDraft(): CreateRideDraft {
  // Set default date to 1 hour from now
  const defaultDate = new Date();
  defaultDate.setHours(defaultDate.getHours() + 1, 0, 0, 0);
  
  return {
    join_mode: "express",
    max_participants: 4,
    pace: null,
    notes: null,
    distance_km: null,
    elevation_m: null,
    start_name: null,
    start_at: defaultDate.toISOString(), // Set default date immediately
    duration_hours: 2, // Default: 2 hours
  };
}

export default function CreateRideWizard() {
  const { t } = useTranslation();
  const theme = useTheme();

  const steps: { key: StepKey; title: string }[] = useMemo(
    () => [
      { key: "when", title: "When" },
      { key: "where", title: "Where" },
      { key: "details", title: "Details" },
      { key: "group", title: "Group" },
      { key: "review", title: "Review" },
    ],
    []
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<CreateRideDraft>(getInitialDraft());

  const [submitting, setSubmitting] = useState(false);
  const canGoNext = draftIsStepValid(stepIndex, draft);

  const stepTitle = steps[stepIndex]?.title ?? "";

  // Reset wizard when user navigates back to Create tab
  useFocusEffect(
    React.useCallback(() => {
      // Reset to initial state when tab gains focus
      setStepIndex(0);
      setDraft(getInitialDraft());
    }, [])
  );

  function updateDraft(patch: Partial<CreateRideDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function onPublish() {
    // Final validation: ensure all required fields exist
    const requiredOk =
      draftIsStepValid(0, draft) &&
      draftIsStepValid(1, draft) &&
      draftIsStepValid(2, draft) &&
      draftIsStepValid(3, draft);

    if (!requiredOk) {
      // If something is missing, jump to the first invalid step
      for (let i = 0; i < 4; i++) {
        if (!draftIsStepValid(i, draft)) {
          setStepIndex(i);
          return;
        }
      }
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error("Not signed in");

    setSubmitting(true);
    try {
      const ride = await createRide({
        owner_id: userId,
        status: "published",

        start_at: draft.start_at!,
        duration_hours: draft.duration_hours!,
        start_lat: draft.start_lat!,  // ← USE ACTUAL COORDINATES
        start_lng: draft.start_lng!,  // ← USE ACTUAL COORDINATES
        start_name: draft.start_name!,

        ride_type: draft.ride_type!,
        skill_level: draft.skill_level!,
        pace: draft.pace ?? null,

        distance_km: draft.distance_km ?? null,
        elevation_m: draft.elevation_m ?? null,

        join_mode: draft.join_mode!,
        max_participants: draft.max_participants!,

        notes: draft.notes ?? null,
      });

      // Reset wizard after publish
      setDraft(getInitialDraft());
      setStepIndex(0);

      console.log("Ride created:", ride.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
   <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
        {stepTitle}
        </Text>

      <Text style={{ color: theme.colors.onBackground, opacity: 0.7, marginTop: 4 }}>
        Step {stepIndex + 1} / {steps.length}
      </Text>
      <Divider style={{ marginVertical: 12 }} />

      {/* Step body */}
      <View style={{ flex: 1 }}>
        {stepIndex === 0 && <StepWhen draft={draft} onChange={updateDraft} />}
        {stepIndex === 1 && <StepWhere draft={draft} onChange={updateDraft} />}
        {stepIndex === 2 && <StepDetails draft={draft} onChange={updateDraft} />}
        {stepIndex === 3 && <StepGroup draft={draft} onChange={updateDraft} />}
        {stepIndex === 4 && <StepReview draft={draft} />}
      </View>

      <Divider style={{ marginVertical: 12 }} />

      {/* Navigation buttons - FORCE LTR so Back is always left, Next always right */}
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
    </View>
  );
}
