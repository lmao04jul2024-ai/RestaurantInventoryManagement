/**
 * Register — mirrors web register (org-code joins a tenant).
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
import { getApiErrorMessage, getApiErrorCode } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeProvider';
import type { AuthStackParamList } from '@/navigation/types';

type Props = StackScreenProps<AuthStackParamList, 'Register'>;

const RegisterScreen = ({ navigation }: Props) => {
  const { theme } = useTheme();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!firstName || !lastName || !email || !password || isSubmitting) {
      setFormError('Please fill in first name, last name, email and password.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        ...(orgCode.trim() ? { tenantId: orgCode.trim() } : {}),
      });
    } catch (err) {
      setFormError(
        getApiErrorCode(err) === 'EMAIL_EXISTS'
          ? 'An account with this email already exists.'
          : getApiErrorMessage(err),
      );
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
          <Text variant="h1">Create account</Text>
          <Text variant="body" tone="muted">
            Join your restaurant&apos;s workspace.
          </Text>
        </View>

        <View style={styles.form}>
          <Input label="First Name" value={firstName} onChangeText={setFirstName} />
          <Input label="Last Name" value={lastName} onChangeText={setLastName} />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            secureTextEntry
            helperText="At least 8 characters."
            value={password}
            onChangeText={setPassword}
          />
          <Input
            label="Organization Code (optional)"
            autoCapitalize="none"
            placeholder="e.g. demo-tenant"
            helperText="Provided by your manager to join an existing restaurant."
            value={orgCode}
            onChangeText={setOrgCode}
          />
          {formError ? <Text tone="danger">{formError}</Text> : null}
          <Button title="Sign Up" onPress={onSubmit} isLoading={isSubmitting} fullWidth />
          <View style={styles.footerRow}>
            <Text tone="muted">Already have an account? </Text>
            <Text tone="primary" onPress={() => navigation.goBack()}>
              Sign in
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 24, gap: 8 },
  form: { gap: 14 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
});

export default RegisterScreen;
