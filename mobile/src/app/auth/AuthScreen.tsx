import React, { useState } from "react";
import { View, StyleSheet } from "react-native";

import LoginScreen from "./LoginScreen";
import ForgotPasswordScreen from "./ForgotPasswordScreen";

type AuthView = "login" | "forgotPassword";

export default function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");

  return (
    <View style={styles.container}>
      {view === "login" && (
        <LoginScreen onForgotPassword={() => setView("forgotPassword")} />
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
