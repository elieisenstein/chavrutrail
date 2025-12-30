import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../../lib/supabase";
import RequestOtp from "../auth/RequestOtp";
import VerifyOtp from "../auth/VerifyOtp";

type Stage = "loading" | "request" | "verify" | "signedin";

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === "true";

// User switcher logic
const DEV_USER = process.env.EXPO_PUBLIC_DEV_USER || "1";
const DEV_EMAIL = process.env[`EXPO_PUBLIC_DEV_USER_${DEV_USER}_EMAIL`] || "";
const DEV_PASSWORD = process.env[`EXPO_PUBLIC_DEV_USER_${DEV_USER}_PASSWORD`] || "";

/**
 * Hard safety: never allow bypass outside dev runtime.
 * __DEV__ is a React Native global that is false in production builds.
 */
function assertBypassSafe() {
  if (DEV_BYPASS && !__DEV__) {
    throw new Error("DEV_AUTH_BYPASS is enabled in a non-dev build. Disable it immediately.");
  }
}

type PendingOtp = { method: "email" | "phone"; identifier: string };

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [pending, setPending] = useState<PendingOtp | null>(null);

  // Clear any previous pending payload whenever we go back to the request stage
  useEffect(() => {
    if (stage === "request") {
      setPending(null);
    }
  }, [stage]);

  useEffect(() => {
    assertBypassSafe();

    let isMounted = true;

    const bootstrap = async () => {
      // If already signed in, go straight to app
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (data.session) {
        setStage("signedin");
        return;
      }

      // DEV bypass: sign in using email/password
      if (DEV_BYPASS) {
        if (!DEV_EMAIL || !DEV_PASSWORD) {
          setStage("request");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: DEV_EMAIL,
          password: DEV_PASSWORD,
        });

        if (!isMounted) return;

        if (error) {
          // Fall back to normal flow if dev login fails
          console.log("DEV bypass login failed:", error.message);
          setStage("request");
        } else {
          setStage("signedin");
        }
        return;
      }

      // Normal flow
      setStage("request");
    };

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only promote to signed-in when we actually have a session.
      // Do NOT force back to "request" here; that can interrupt the verify flow.
      if (session) setStage("signedin");
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (stage === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (stage === "request") {
    return (
      <RequestOtp
        onSent={(payload) => {
          setPending(payload);
          setStage("verify");
        }}
      />
    );
  }

  if (stage === "verify") {
    // Safety: if user somehow reached verify without payload, restart flow
    if (!pending) {
      return (
        <RequestOtp
          onSent={(payload) => {
            setPending(payload);
            setStage("verify");
          }}
        />
      );
    }

    return (
      <VerifyOtp
        method={pending.method}
        identifier={pending.identifier}
        onDone={() => setStage("signedin")}
      />
    );
  }

  return <>{children}</>;
}
