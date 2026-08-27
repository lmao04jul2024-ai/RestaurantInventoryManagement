/**
 * App entry — provider composition mirrors packages/web/src/app/providers.tsx.
 * Order matters: ThemeProvider must wrap NavigationContainer so its theme can
 * derive nav colors; the auth gate lives inside RootNavigator.
 */
import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import RootNavigator from '@/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Keeps the OS status bar in sync with the active theme mode */
const ThemedStatusBar = () => {
  const { theme } = useTheme();
  return (
    <StatusBar
      barStyle={theme.dark ? 'light-content' : 'dark-content'}
      backgroundColor={theme.surface}
    />
  );
};

/** Bridges our token theme into react-navigation's theme contract */
const ThemedNavigationContainer = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: theme.dark,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary[600],
      background: theme.surface,
      card: theme.surface,
      text: theme.contentDefault,
      border: theme.border,
      notification: theme.danger[500],
    },
  };
  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
};

const App = () => (
  <GestureHandlerRootView style={styles.flex}>
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <QueryClientProvider client={queryClient}>
          <ThemedNavigationContainer>
            <View style={[styles.flex, { backgroundColor: 'transparent' }]}>
              <RootNavigator />
            </View>
          </ThemedNavigationContainer>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default App;
