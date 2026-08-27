/**
 * Settings — theme mode toggle (system-follow lands with Appearance later),
 * session info and logout.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from '@/components/ui';
import { API_BASE_URL } from '@/config';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeProvider';

const SettingsScreen = () => {
  const { theme, mode, setMode } = useTheme();
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={{ backgroundColor: theme.surfaceMuted }}
      contentContainerStyle={styles.content}
    >
      <Text variant="h2">Settings</Text>

      <Card>
        <Text variant="h3">Appearance</Text>
        <View style={styles.row}>
          <Button
            title="Light"
            size="sm"
            variant={mode === 'light' ? 'primary' : 'outline'}
            onPress={() => setMode('light')}
          />
          <Button
            title="Dark"
            size="sm"
            variant={mode === 'dark' ? 'primary' : 'outline'}
            onPress={() => setMode('dark')}
          />
        </View>
      </Card>

      <Card>
        <Text variant="h3">Session</Text>
        <Text variant="bodySmall" tone="muted" style={styles.meta}>
          API: {API_BASE_URL}
        </Text>
        <Text variant="bodySmall" tone="muted">
          Tenant: {user?.tenantId}
        </Text>
      </Card>

      <Button title="Sign Out" variant="danger" onPress={() => void logout()} fullWidth />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  meta: { marginTop: 8 },
});

export default SettingsScreen;
