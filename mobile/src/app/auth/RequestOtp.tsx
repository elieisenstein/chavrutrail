// RequestOtp.tsx
// RequestOtp.tsx
// ⚠️ CURRENTLY DISABLED - See auth/README.md
// OTP auth disabled due to Supabase rate limits (2 emails/hour)
// Using password auth instead for MVP


import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type AuthMethod = "email" | "phone";

type Props = {
  onSent: (payload: { method: AuthMethod; identifier: string }) => void;
};

export default function RequestOtp({ onSent }: Props) {
  const { t } = useTranslation();

  const [method, setMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const identifier = useMemo(() => {
    return method === "email" ? email.trim() : phone.trim();
  }, [method, email, phone]);

  const canSend = useMemo(() => {
    if (loading) return false;
    if (method === "email") return identifier.includes("@") && identifier.includes(".");
    // Expect E.164 like +9725...
    return identifier.startsWith("+") && identifier.length >= 8;
  }, [loading, method, identifier]);

  const send = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { error } =
        method === "email"
          ? await supabase.auth.signInWithOtp({ email: identifier })
          : await supabase.auth.signInWithOtp({ phone: identifier });
      console.log("signInWithOtp:", error);
      if (error) throw error;

      onSent({ method, identifier });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, marginTop: 80 }}>
      <Text variant="headlineSmall">{t("auth.title")}</Text>

      <SegmentedButtons
        value={method}
        onValueChange={(v) => setMethod(v as AuthMethod)}
        buttons={[
          { value: "email", label: t("auth.email") ?? "Email" },
          { value: "phone", label: t("auth.phone") ?? "Phone" },
        ]}
      />

      {method === "email" ? (
        <TextInput
          label={t("auth.emailLabel") ?? "Email"}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
        />
      ) : (
        <TextInput
          label={t("auth.phoneLabel") ?? "Phone number"}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoCapitalize="none"
          placeholder="+9725XXXXXXXX"
        />
      )}

      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="contained" onPress={send} loading={loading} disabled={!canSend}>
        {t("auth.sendCode") ?? "Send code"}
      </Button>

      {method === "email" ? (
        <Text style={{ opacity: 0.7 }}>
          {t("auth.emailOtpHint") ?? "We’ll email you a one-time code."}
        </Text>
      ) : (
        <Text style={{ opacity: 0.7 }}>
          {t("auth.phoneOtpHint") ?? "We’ll text you a one-time code."}
        </Text>
      )}
    </View>
  );
}
