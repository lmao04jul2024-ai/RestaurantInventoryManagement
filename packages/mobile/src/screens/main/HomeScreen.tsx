/**
 * Home — session landing. Proves end-to-end wiring: auth store → role badge,
 * tokens → themed surfaces. Feature screens arrive with Weeks 7+.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

const HomeScreen = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.surfaceMuted }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text variant="h2">
          Hi, {user?.firstName ?? 'there'} 👋
        </Text>
        <Text variant="body" tone="muted">
          Here&apos;s your restaurant at a glance.
        </Text>
      </View>

      <Card>
        <Text variant="caption" tone="muted">
          SIGNED IN AS
        </Text>
        <Text variant="h3" style={{ marginTop: 4 }}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text variant="bodySmall" tone="muted">
          {user?.email}
        </Text>
        <View
          style={[
            styles.roleBadge,
            { backgroundColor: withAlpha(theme.primary[600], 0.2) },
          ]}
        >
          <Text variant="caption" tone="primary">
            {user?.role}
          </Text>
        </View>
      </Card>

      <Card>
        <Text variant="body" tone="muted">
          Menus, orders and inventory modules land in upcoming sprints — this
          shell already authenticates against your tenant backend.
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  header: { marginBottom: 8, gap: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 12,
  },
});

export default HomeScreen;
