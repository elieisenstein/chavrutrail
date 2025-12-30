// VerifyOtp.tsx

// VerifyOtp.tsx
// ⚠️ CURRENTLY DISABLED - See auth/README.md
// OTP auth disabled due to Supabase rate limits (2 emails/hour)
// Using password auth instead for MVP
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type AuthMethod = "email" | "phone";

type Props = {
  method: AuthMethod;
  identifier: string; // email or phone in E.164
  onDone: () => void;
};

export default function VerifyOtp({ method, identifier, onDone }: Props) {
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canVerify = useMemo(() => {
    const c = code.trim();
    return !loading && c.length >= 4; // email OTP length may vary
  }, [loading, code]);

  const verify = async () => {
    setErr(null);
    setLoading(true);
    try {
      const token = code.trim();

      const { error } =
        method === "email"
          ? await supabase.auth.verifyOtp({
              email: identifier.trim(),
              token,
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone: identifier.trim(),
              token,
              type: "sms",
            });

      if (error) throw error;

      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, marginTop: 80 }}>
      <Text variant="headlineSmall">{t("auth.verifyTitle") ?? "Verify"}</Text>
      <Text style={{ opacity: 0.7 }}>{identifier}</Text>

      <TextInput
        label={t("auth.codeLabel") ?? "Code"}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
      />

      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="contained" onPress={verify} loading={loading} disabled={!canVerify}>
        {t("auth.verify") ?? "Verify"}
      </Button>
    </View>
  );
}
