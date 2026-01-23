import React from "react";
import { ScrollView } from "react-native";
import { Text, TextInput, Divider, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { CreateRideDraft } from "../createRideTypes";
import { formatDateTimeLocal } from "../../../../lib/datetime";
import IsraelHikingMapView from "../../../../components/IsraelHikingMapView";

export default function StepReview({ draft, onChange }: { draft: CreateRideDraft; onChange: (patch: Partial<CreateRideDraft>) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        {t("createRide.review.title")}
      </Text>

      <Divider />

      {/* When */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.when")} </Text>
        {draft.start_at ? formatDateTimeLocal(draft.start_at) : "-"}
      </Text>

      {/* Where */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.where")} </Text>
        {draft.start_name || "-"}
      </Text>

      {/* Route Description */}
      {draft.notes && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>{t("createRide.review.route")} </Text>
          {draft.notes}
        </Text>
      )}

      {/* Meeting Location Map */}
      {(() => {
        const lat = draft.start_lat;
        const lng = draft.start_lng;
        return lat !== undefined && lng !== undefined ? (
          <>
            <Text style={{ color: theme.colors.onBackground, fontWeight: "bold", marginTop: 8 }}>
              {t("createRide.review.meetingLocation")}
            </Text>
            <IsraelHikingMapView
              center={[lng, lat]}
              zoom={14}
              height={200}
              interactive={false}
              markers={[{ coordinate: [lng, lat], id: "meeting" }]}
            />
          </>
        ) : null;
      })()}

      <Divider style={{ marginTop: 12 }} />

      {/* Details */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.type")} </Text>
        {draft.ride_type ? t(`rideTypes.${draft.ride_type}`) : "-"}
      </Text>

      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.skill")} </Text>
        {draft.skill_level ? t(`skillLevels.${draft.skill_level}`) : "-"}
      </Text>

      {draft.pace && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>{t("createRide.review.pace")} </Text>
          {t(`paceOptions.${draft.pace}`)}
        </Text>
      )}

      {draft.distance_km != null && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>{t("createRide.review.distance")} </Text>
          {draft.distance_km} km
        </Text>
      )}

      {draft.elevation_m != null && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>{t("createRide.review.elevation")} </Text>
          {draft.elevation_m} m
        </Text>
      )}

      {/* Group */}
      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.groupMode")} </Text>
        {draft.join_mode === "express"
          ? t("createRide.review.groupModeExpress")
          : t("createRide.review.groupModeApproval")}
      </Text>

      <Text style={{ color: theme.colors.onBackground }}>
        <Text style={{ fontWeight: "bold" }}>{t("createRide.review.maxParticipants")} </Text>
        {draft.max_participants || "-"}
      </Text>

      {draft.gender_preference && (
        <Text style={{ color: theme.colors.onBackground }}>
          <Text style={{ fontWeight: "bold" }}>{t("createRide.group.genderPreference")}: </Text>
          {t(`createRide.group.genderOptions.${draft.gender_preference}`)}
        </Text>
      )}

      <Divider />

      <Text style={{ color: theme.colors.onBackground, fontWeight: "bold", marginTop: 8 }}>
        {t("createRide.review.whatsappLink")}
      </Text>
      <TextInput
        mode="outlined"
        value={draft.whatsapp_link ?? ""}
        onChangeText={(text) => onChange({ whatsapp_link: text || null })}
        placeholder={t("createRide.review.whatsappPlaceholder")}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        dense
      />

      <Text style={{ opacity: 0.7, fontStyle: "italic" }}>
        {t("createRide.review.publishPrompt")}
      </Text>
    </ScrollView>
  );
}