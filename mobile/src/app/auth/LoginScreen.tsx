import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type Props = {
  onForgotPassword: () => void;
  onSignUp: () => void;
};

export default function LoginScreen({ onForgotPassword, onSignUp }: Props) {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const canLogin = 
    email.trim().includes("@") && 
    email.trim().includes(".") && 
    password.length >= 6 && 
    !loading;

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) throw error;
      
      // Success - auth state listener will handle navigation
    } catch (e: any) {
      console.error("Login error:", e);
      
      // Provide helpful error messages
      if (e.message.includes("Invalid login credentials")) {
        setError(t("auth.invalidCredentials") ?? "Invalid email or password");
      } else if (e.message.includes("Email not confirmed")) {
        setError(t("auth.emailNotConfirmed") ?? "Please verify your email first");
      } else {
        setError(e.message ?? t("auth.loginFailed") ?? "Failed to log in");
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
            {t("auth.welcomeBack") ?? "Welcome to Bishvil"}
          </Text>
          
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t("auth.signInToContinue") ?? "Sign in to find your riding partners"}
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

          <TextInput
            label={t("auth.passwordLabel") ?? "Password"}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoComplete="password"
            autoCapitalize="none"
            disabled={loading}
            mode="outlined"
            style={styles.input}
            error={!!error}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          {error && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          <Button 
            mode="contained" 
            onPress={handleLogin} 
            loading={loading} 
            disabled={!canLogin}
            style={styles.loginButton}
          >
            {t("auth.signIn") ?? "Sign In"}
          </Button>

          <Button
            mode="text"
            onPress={onForgotPassword}
            disabled={loading}
            style={styles.forgotButton}
          >
            {t("auth.forgotPassword") ?? "Forgot password?"}
          </Button>

          <Button
            mode="text"
            onPress={onSignUp}
            disabled={loading}
            style={styles.signUpButton}
          >
            {t("auth.createAccount") ?? "Create account"}
          </Button>

          <View style={styles.betaNotice}>
            <Text variant="bodySmall" style={styles.betaText}>
              {t("auth.betaAccess") ?? "Currently in beta - limited access"}
            </Text>
          </View>
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
  error: {
    color: "#B71C1C",
    textAlign: "center",
  },
  loginButton: {
    marginTop: 8,
  },
  forgotButton: {
    marginTop: 4,
  },
  signUpButton: {
    marginTop: 4,
  },
  betaNotice: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
  },
  betaText: {
    textAlign: "center",
    opacity: 0.6,
  },
});