/**
 * Top-level auth gate — hydration-safe swap between auth stack and the main
 * app (the RN equivalent of web's ProtectedRoute).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Spinner from '@/components/ui/Spinner';
import AppText from '@/components/ui/Text';
import { useAuthStore, useHasHydratedAuth } from '@/store/auth.store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const RootNavigator = () => {
  const hasHydrated = useHasHydratedAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!hasHydrated) {
    return (
      <View style={[styles.splash]}>
        <Spinner />
        <AppText variant="caption" tone="muted">
          Restoring session…
        </AppText>
      </View>
    );
  }

  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
};

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});

export default RootNavigator;
