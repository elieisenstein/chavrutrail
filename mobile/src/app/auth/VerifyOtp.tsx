import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type Props = { phone: string; onDone: () => void };

export default function VerifyOtp({ phone, onDone }: Props) {
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const verify = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      });
      if (error) throw error;
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, marginTop: 80 }}>
      <Text variant="headlineSmall">{t("auth.verifyTitle")}</Text>

      <Text style={{ opacity: 0.7 }}>{phone}</Text>

      <TextInput
        label={t("auth.codeLabel")}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
      />

      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="contained" onPress={verify} loading={loading} disabled={loading}>
        {t("auth.verify")}
      </Button>
    </View>
  );
}
