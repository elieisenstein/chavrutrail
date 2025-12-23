import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Divider, Text } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../../lib/supabase";
import { createRide } from "../../../lib/rides";
import { CreateRideDraft, draftIsStepValid } from "./createRideTypes";

import StepWhen from "./steps/StepWhen";
import StepWhere from "./steps/StepWhere";
import StepDetails from "./steps/StepDetails";
import StepGroup from "./steps/StepGroup";
import StepReview from "./steps/StepReview";

type StepKey = "when" | "where" | "details" | "group" | "review";

export default function CreateRideWizard() {
  const { t } = useTranslation();

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
  const [draft, setDraft] = useState<CreateRideDraft>({
    join_mode: "express",
    max_participants: 4,
    pace: null,
    notes: null,
    distance_km: null,
    elevation_m: null,
    start_name: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const canGoNext = draftIsStepValid(stepIndex, draft);

  const stepTitle = steps[stepIndex]?.title ?? "";

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
        start_lat: draft.start_lat!,
        start_lng: draft.start_lng!,
        start_name: draft.start_name ?? null,

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
      setDraft({
        join_mode: "express",
        max_participants: 4,
        pace: null,
        notes: null,
        distance_km: null,
        elevation_m: null,
        start_name: null,
      });
      setStepIndex(0);

      // For now: simple confirmation
      // Later: navigate to ride details or show snackbar
      console.log("Ride created:", ride.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Header */}
      <Text variant="titleLarge">{stepTitle}</Text>
      <Text style={{ opacity: 0.7, marginTop: 4 }}>
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

      {/* Navigation buttons */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button
          mode="outlined"
          disabled={stepIndex === 0 || submitting}
          onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
          style={{ flex: 1 }}
        >
          Back
        </Button>

        {stepIndex < steps.length - 1 ? (
          <Button
            mode="contained"
            disabled={!canGoNext || submitting}
            onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            style={{ flex: 1 }}
          >
            Next
          </Button>
        ) : (
          <Button mode="contained" disabled={submitting} loading={submitting} onPress={onPublish} style={{ flex: 1 }}>
            Publish
          </Button>
        )}
      </View>
    </View>
  );
}
