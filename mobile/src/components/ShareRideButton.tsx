import React from "react";
import { Share } from "react-native";
import { Button } from "react-native-paper";
import { formatShareMessage } from "../lib/deepLinking";

interface ShareRideButtonProps {
  rideId: string;
  rideTitle: string;
  isHebrew: boolean;
  disabled?: boolean;
}

export function ShareRideButton({ rideId, rideTitle, isHebrew, disabled }: ShareRideButtonProps) {
  const handleShare = async () => {
    const message = formatShareMessage(rideTitle, rideId, isHebrew);

    try {
      await Share.share({
        message,
        title: isHebrew ? "שתף רכיבה" : "Share Ride",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  return (
    <Button
      mode="contained"
      icon="share-variant"
      onPress={handleShare}
      style={{ marginTop: 8 }}
      disabled={disabled}
    >
      {isHebrew ? "שתף רכיבה" : "Share Ride"}
    </Button>
  );
}