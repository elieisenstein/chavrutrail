import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type Props = {
  onBack: () => void;
};

export default function ForgotPasswordScreen({ onBack }: Props) {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = email.trim().includes("@") && !loading && !success;

  const handleResetPassword = async () => {
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: 'chavrutrail://reset-password', // Deep link for your app
        }
      );

      if (error) throw error;

      setSuccess(true);
    } catch (e: any) {
      console.error("Password reset error:", e);
      
      // Note: Supabase doesn't reveal if email exists for security
      if (e.message.includes("rate limit")) {
        setError(t("auth.rateLimitError") ?? "Too many requests. Please try again later.");
      } else {
        setError(e.message ?? t("auth.resetFailed") ?? "Failed to send reset email");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          {t("auth.checkEmail") ?? "Check your email"}
        </Text>
        
        <Text variant="bodyMedium" style={styles.description}>
          {t("auth.resetEmailSent") ?? 
            "If an account exists with that email, we've sent password reset instructions."}
        </Text>

        <Text variant="bodySmall" style={styles.note}>
          {t("auth.checkSpam") ?? "Don't see it? Check your spam folder."}
        </Text>

        <Button 
          mode="contained" 
          onPress={onBack}
          style={styles.button}
        >
          {t("auth.backToLogin") ?? "Back to login"}
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        {t("auth.resetPassword") ?? "Reset password"}
      </Text>
      
      <Text variant="bodyMedium" style={styles.description}>
        {t("auth.resetInstructions") ?? 
          "Enter your email and we'll send you instructions to reset your password."}
      </Text>

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
        error={!!error}
      />

      {error && (
        <Text style={styles.error}>
          {error}
        </Text>
      )}

      <Button 
        mode="contained" 
        onPress={handleResetPassword} 
        loading={loading} 
        disabled={!canSubmit}
        style={styles.button}
      >
        {t("auth.sendResetLink") ?? "Send reset link"}
      </Button>

      <Button 
        mode="text" 
        onPress={onBack}
        disabled={loading}
      >
        {t("auth.backToLogin") ?? "Back to login"}
      </Button>

      <Text variant="bodySmall" style={styles.warning}>
        ⚠️ {t("auth.rateLimitWarning") ?? "Email sending is rate limited (2/hour)"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 16,
  },
  note: {
    textAlign: "center",
    opacity: 0.6,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "transparent",
  },
  error: {
    color: "#B71C1C",
    textAlign: "center",
  },
  button: {
    marginTop: 8,
  },
  warning: {
    textAlign: "center",
    opacity: 0.6,
    marginTop: 16,
    color: "#F57C00",
  },
});