/**
 * Authenticated shell. Role-gated tab sets arrive with staff features later;
 * Week 5 ships the common Home + Settings shell.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AppText from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import HomeScreen from '@/screens/main/HomeScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';

const Tab = createBottomTabNavigator();

const MainNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary[600],
        tabBarInactiveTintColor: theme.contentMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: ({ color }) => (
            <AppText variant="caption" style={{ color }}>
              Home
            </AppText>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: ({ color }) => (
            <AppText variant="caption" style={{ color }}>
              Settings
            </AppText>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
