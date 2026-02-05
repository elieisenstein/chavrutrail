import React, { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, Text, TextInput, Chip, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";
import {
  isDisplayNameAvailable,
  updateProfileById,
  rideTypesToString
} from "../../lib/profile";

const RIDE_TYPES = ["Trail", "Enduro", "Gravel", "Road"];

type Props = {
  onSignIn: () => void;
};

export default function SignUpScreen({ onSignIn }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRideTypes, setSelectedRideTypes] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);

  // Phone validation helpers
  const normalizePhone = (input: string): string => {
    return input.trim().replace(/[\s\-()]/g, '');
  };

  const isValidLocalPhone = (input: string): boolean => {
    const normalized = normalizePhone(input);
    return /^05\d{8}$/.test(normalized);
  };

  const toE164 = (localPhone: string): string => {
    const normalized = normalizePhone(localPhone);
    return '+972' + normalized.substring(1);
  };

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Display name validation state
  const [nameCheckStatus, setNameCheckStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [nameCheckDebounce, setNameCheckDebounce] = useState<NodeJS.Timeout | null>(null);

  const isRTL = i18n.language === "he";

  // Display order for RTL
  const rideTypesDisplay = isRTL ? [...RIDE_TYPES].reverse() : RIDE_TYPES;
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

  const chipTextDir = {
    writingDirection: isRTL ? "rtl" : "ltr",
    textAlign: "center" as const,
  };

  const chipRowStyle = {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: 16,
    justifyContent: isRTL ? ("flex-end" as const) : ("flex-start" as const),
  };

  // Debounced display name availability check
  useEffect(() => {
    if (nameCheckDebounce) {
      clearTimeout(nameCheckDebounce);
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setNameCheckStatus("idle");
      return;
    }

    setNameCheckStatus("checking");

    const timeout = setTimeout(async () => {
      try {
        const available = await isDisplayNameAvailable(trimmedName);
        setNameCheckStatus(available ? "available" : "taken");
      } catch (e) {
        console.error("Name check error:", e);
        setNameCheckStatus("idle");
      }
    }, 500);

    setNameCheckDebounce(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [displayName]);

  const toggleRideType = (type: string) => {
    if (selectedRideTypes.includes(type)) {
      setSelectedRideTypes(selectedRideTypes.filter((t) => t !== type));
    } else {
      setSelectedRideTypes([...selectedRideTypes, type]);
    }
  };

  const canSignUp =
    displayName.trim().length > 0 &&
    nameCheckStatus === "available" &&
    email.trim().includes("@") &&
    email.trim().includes(".") &&
    isValidLocalPhone(phone) &&
    password.length >= 6 &&
    confirmPassword === password &&
    selectedRideTypes.length > 0 &&
    selectedGender !== null &&
    !loading;

  const handleSignUp = async () => {
    setError(null);
    setLoading(true);

    try {
      // Final check for display name availability
      const available = await isDisplayNameAvailable(displayName.trim());
      if (!available) {
        setError(t("auth.displayNameTaken") ?? "This name is already taken");
        setLoading(false);
        return;
      }

      // Create auth user without email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: undefined,
          data: {
            display_name: displayName.trim(), // Store in user metadata
          },
        },
      });

      if (authError) throw authError;

      // Get user ID from signup response (session may not be ready yet)
      const userId = authData.user?.id;
      if (!userId) throw new Error("No user ID returned from signup");

      // Update profile with additional fields using userId directly
      // DB trigger creates empty profile, we populate it
      await updateProfileById(userId, {
        display_name: displayName.trim(),
        ride_type: rideTypesToString(selectedRideTypes),
        gender: selectedGender,
        phone_number: toE164(phone),
      });

      // Success - auth state listener will handle navigation
    } catch (e: any) {
      console.error("Sign up error:", e);

      // Provide helpful error messages
      if (e.message.includes("User already registered")) {
        setError(t("auth.emailAlreadyRegistered") ?? "This email is already registered");
      } else if (e.message.includes("duplicate key")) {
        setError(t("auth.displayNameTaken") ?? "This name is already taken");
      } else {
        setError(e.message ?? t("auth.signUpFailed") ?? "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text variant="headlineMedium" style={styles.title}>
            {t("auth.signUp") ?? "Create Account"}
          </Text>

          <Text variant="bodyMedium" style={styles.subtitle}>
            {t("auth.completeProfileToStart") ?? "Complete your profile to get started"}
          </Text>

          {/* Display Name */}
          <TextInput
            label={t("auth.displayNameLabel") ?? "Display Name"}
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              setError(null);
            }}
            autoComplete="name"
            autoCapitalize="words"
            disabled={loading}
            mode="outlined"
            style={styles.input}
            contentStyle={dirText}
            error={nameCheckStatus === "taken"}
            right={
              nameCheckStatus === "checking" ? (
                <TextInput.Icon icon="clock-outline" />
              ) : nameCheckStatus === "available" ? (
                <TextInput.Icon icon="check-circle" color={theme.colors.primary} />
              ) : nameCheckStatus === "taken" ? (
                <TextInput.Icon icon="close-circle" color={theme.colors.error} />
              ) : null
            }
          />
          {nameCheckStatus === "checking" && (
            <Text style={[styles.helperText, { color: theme.colors.outline }]}>
              {t("auth.displayNameChecking") ?? "Checking availability..."}
            </Text>
          )}
          {nameCheckStatus === "available" && (
            <Text style={[styles.helperText, { color: theme.colors.primary }]}>
              {t("auth.displayNameAvailable") ?? "Name is available"}
            </Text>
          )}
          {nameCheckStatus === "taken" && (
            <Text style={[styles.helperText, { color: theme.colors.error }]}>
              {t("auth.displayNameTaken") ?? "This name is already taken"}
            </Text>
          )}

          {/* Email */}
          <TextInput
            label={t("auth.emailLabel") ?? "Email"}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            disabled={loading}
            mode="outlined"
            style={styles.input}
            contentStyle={dirText}
            error={!!error}
          />

          {/* Phone Number */}
          <TextInput
            label={t("auth.phoneLabel") ?? "Phone Number"}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setError(null);
            }}
            placeholder="05XXXXXXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            disabled={loading}
            mode="outlined"
            style={styles.input}
            contentStyle={dirText}
            error={phone.length > 0 && !isValidLocalPhone(phone)}
          />
          {phone.length > 0 && !isValidLocalPhone(phone) && (
            <Text style={[styles.helperText, { color: theme.colors.error }]}>
              {t("auth.invalidPhone") ?? "Please enter a valid Israeli mobile number (05XXXXXXXX)"}
            </Text>
          )}
          <Text style={[styles.helperText, { color: theme.colors.outline, marginTop: phone.length > 0 && !isValidLocalPhone(phone) ? 4 : -8 }]}>
            {t("auth.phoneHelp") ?? "Your phone helps riders coordinate safely. It stays private and is only used for ride communication."}
          </Text>

          {/* Password */}
          <TextInput
            label={t("auth.passwordLabel") ?? "Password"}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            autoCapitalize="none"
            disabled={loading}
            mode="outlined"
            style={styles.input}
            contentStyle={dirText}
            error={!!error}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {/* Confirm Password */}
          <TextInput
            label={t("auth.confirmPassword") ?? "Confirm Password"}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            secureTextEntry={!showConfirmPassword}
            autoComplete="password-new"
            autoCapitalize="none"
            disabled={loading}
            mode="outlined"
            style={styles.input}
            contentStyle={dirText}
            error={!!error || (confirmPassword.length > 0 && confirmPassword !== password)}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? "eye-off" : "eye"}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />
          {confirmPassword.length > 0 && confirmPassword !== password && (
            <Text style={[styles.helperText, { color: theme.colors.error }]}>
              {t("auth.passwordsDoNotMatch") ?? "Passwords do not match"}
            </Text>
          )}

          {/* Ride Types */}
          <Text variant="titleMedium" style={[styles.sectionTitle, dirText]}>
            {t("auth.selectRideTypes") ?? "What do you ride?"}
          </Text>
          <View style={chipRowStyle}>
            {rideTypesDisplay.map((type) => {
              const isSelected = selectedRideTypes.includes(type);
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
            <Text style={[styles.helperText, { color: theme.colors.error }]}>
              {t("profile.rideTypesRequired") ?? "Please select at least one ride type"}
            </Text>
          )}

          {/* Gender */}
          <Text variant="titleMedium" style={[styles.sectionTitle, dirText]}>
            {t("auth.selectGender") ?? "Gender"}
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

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={!canSignUp}
            style={styles.signUpButton}
          >
            {t("auth.signUp") ?? "Sign Up"}
          </Button>

          <Button
            mode="text"
            onPress={onSignIn}
            disabled={loading}
            style={styles.signInButton}
          >
            {t("auth.alreadyHaveAccount") ?? "Already have an account? Sign in"}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  form: {
    padding: 24,
    gap: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 24,
  },
  input: {
    backgroundColor: "transparent",
  },
  helperText: {
    fontSize: 12,
    marginTop: -12,
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
  },
  error: {
    color: "#B71C1C",
    textAlign: "center",
    marginTop: 8,
  },
  signUpButton: {
    marginTop: 8,
  },
  signInButton: {
    marginTop: 4,
  },
});
