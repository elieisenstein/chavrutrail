import React, { useState } from "react";
import { View } from "react-native";
import { Text, TextInput, Button } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { supabase } from "../../lib/supabase";

type Props = { onSent: (phone: string) => void };

export default function RequestOtp({ onSent }: Props) {
  const { t } = useTranslation();

  const [phone, setPhone] = useState("+972");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      onSent(phone);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12, marginTop: 80 }}>
      <Text variant="headlineSmall">{t("auth.title")}</Text>

      <TextInput
        label={t("auth.phoneLabel")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />

      {err ? <Text style={{ color: "crimson" }}>{err}</Text> : null}

      <Button mode="contained" onPress={send} loading={loading} disabled={loading}>
        {t("auth.sendCode")}
      </Button>
    </View>
  );
}
