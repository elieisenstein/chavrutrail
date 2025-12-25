import React, { useState } from "react";
import { View, Platform } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CreateRideDraft } from "../createRideTypes";

export default function StepWhen({
  draft,
  onChange,
}: {
  draft: CreateRideDraft;
  onChange: (patch: Partial<CreateRideDraft>) => void;
}) {
  const theme = useTheme();
  
  // Get current selected date or default to 1 hour from now
  const selectedDate = draft.start_at ? new Date(draft.start_at) : new Date(Date.now() + 60 * 60 * 1000);
  
  // Track if pickers are visible (Android shows modal, iOS shows inline)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  function handleDateChange(event: any, date?: Date) {
    // Android: close picker after selection
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    
    if (date) {
      // Preserve the time, only update the date
      const newDate = new Date(selectedDate);
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      onChange({ start_at: newDate.toISOString() });
    }
  }

  function handleTimeChange(event: any, date?: Date) {
    // Android: close picker after selection
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    
    if (date) {
      // Preserve the date, only update the time
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
      onChange({ start_at: newDate.toISOString() });
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        When does the ride start?
      </Text>

      {/* Date/Time Selection */}
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.onBackground, opacity: 0.7 }}>
          Choose date & time:
        </Text>

        {/* Date Picker Button (Android) or Inline Picker (iOS) */}
        {Platform.OS === "android" && (
          <Button 
            mode="contained" 
            onPress={() => setShowDatePicker(true)}
            icon="calendar"
          >
            {selectedDate.toLocaleDateString()}
          </Button>
        )}

        {(showDatePicker || Platform.OS === "ios") && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            minimumDate={new Date()} // Can't create rides in the past
            style={{ backgroundColor: theme.colors.surface }}
          />
        )}

        {/* Time Picker Button (Android) or Inline Picker (iOS) */}
        {Platform.OS === "android" && (
          <Button 
            mode="contained" 
            onPress={() => setShowTimePicker(true)}
            icon="clock-outline"
          >
            {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Button>
        )}

        {(showTimePicker || Platform.OS === "ios") && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            style={{ backgroundColor: theme.colors.surface }}
          />
        )}
      </View>

      {/* Selected Date/Time Display */}
      <View 
        style={{ 
          padding: 16, 
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: 8 
        }}
      >
        <Text style={{ color: theme.colors.onBackground, opacity: 0.7 }}>
          Selected:
        </Text>
        <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
          {selectedDate.toLocaleDateString([], { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
        <Text variant="titleLarge" style={{ color: theme.colors.onBackground }}>
          {selectedDate.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
          })}
        </Text>
      </View>
    </View>
  );
}
