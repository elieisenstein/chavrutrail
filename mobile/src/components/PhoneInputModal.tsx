import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type PhoneInputModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (phoneNumber: string) => void;
  message?: string;
};

/**
 * Validates an Israeli phone number and returns the normalized +972 format.
 * Accepts: 05XXXXXXXX (10 digits) or +9725XXXXXXXX (13 chars).
 * Returns the normalized string or null if invalid.
 */
export function validateIsraeliPhone(input: string): string | null {
  const trimmed = input.trim().replace(/[\s\-()]/g, '');

  // Local format: 05XXXXXXXX (10 digits)
  if (/^05\d{8}$/.test(trimmed)) {
    return '+972' + trimmed.substring(1); // Remove leading 0, add +972
  }

  // International format: +9725XXXXXXXX (13 chars)
  if (/^\+9725\d{8}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export default function PhoneInputModal({
  visible,
  onClose,
  onSave,
  message,
}: PhoneInputModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPhone('');
      setError('');
    }
  }, [visible]);

  const handleSave = () => {
    const normalized = validateIsraeliPhone(phone);
    if (!normalized) {
      setError(t('phoneModal.invalidPhone'));
      return;
    }
    onSave(normalized);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleLarge" style={styles.title}>
            {t('phoneModal.title')}
          </Text>

          <Text variant="bodyMedium" style={styles.message}>
            {message || t('phoneModal.message')}
          </Text>

          <TextInput
            mode="outlined"
            label={t('profile.phoneNumber')}
            placeholder={t('phoneModal.placeholder')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (error) setError('');
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={!!error}
            style={styles.input}
          />

          {error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <Text style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}>
            {t('phoneModal.formatHint')}
          </Text>

          <View style={styles.buttons}>
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.button, { flex: 1 }]}
            >
              {t('phoneModal.save')}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
  },
  hintText: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  button: {
    minWidth: 80,
  },
});
