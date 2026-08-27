/**
 * Forgot password — anti-enumeration endpoint always answers success.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Button, Input, Text } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api';
import { authService } from '@/services/auth.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { AuthStackParamList } from '@/navigation/types';

type Props = StackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await authService.forgotPassword({ email: email.trim() });
      setSuccessMessage(res.message ?? 'Check your inbox for a reset link.');
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.surface }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="h1">Reset password</Text>
            <Text variant="body" tone="muted">
              We&apos;ll email you a reset link.
            </Text>
          </View>

          {successMessage ? (
            <View style={styles.form}>
              <Text tone="default">{successMessage}</Text>
              <Button
                title="Back to Sign In"
                variant="outline"
                onPress={() => navigation.popToTop()}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {formError ? <Text tone="danger">{formError}</Text> : null}
              <Button title="Send Reset Link" onPress={onSubmit} isLoading={isSubmitting} fullWidth />
              <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 32 },
  header: { gap: 8 },
  form: { gap: 16 },
});

export default ForgotPasswordScreen;
