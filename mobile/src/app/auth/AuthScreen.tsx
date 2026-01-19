import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import LoginScreen from "./LoginScreen";
import SignUpScreen from "./SignUpScreen";
import ForgotPasswordScreen from "./ForgotPasswordScreen";

type AuthView = "login" | "signup" | "forgotPassword";

export default function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");

  return (
    <View style={styles.container}>
      {view === "login" && (
        <LoginScreen
          onForgotPassword={() => setView("forgotPassword")}
          onSignUp={() => setView("signup")}
        />
      )}

      {view === "signup" && (
        <SignUpScreen onSignIn={() => setView("login")} />
      )}

      {view === "forgotPassword" && (
        <ForgotPasswordScreen onBack={() => setView("login")} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
