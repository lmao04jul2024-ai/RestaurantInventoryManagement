/**
 * Login — parity with web (auth)/login flow against POST /api/auth/login.
 * Session swap is automatic: setCredentials flips the RootNavigator gate.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Button, Input, Text } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeProvider';
import type { AuthStackParamList } from '@/navigation/types';

type Props = StackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const { theme } = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email || !password || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="h1">Welcome back</Text>
          <Text variant="body" tone="muted">
            Sign in to manage your restaurant.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@restaurant.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          {formError ? <Text tone="danger">{formError}</Text> : null}
          <Button title="Sign In" onPress={onSubmit} isLoading={isSubmitting} fullWidth />
          <Button
            title="Forgot password?"
            variant="ghost"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
          <View style={styles.footerRow}>
            <Text tone="muted">New here? </Text>
            <Text tone="primary" onPress={() => navigation.navigate('Register')}>
              Create an account
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 32, gap: 8 },
  form: { gap: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
});

export default LoginScreen;
