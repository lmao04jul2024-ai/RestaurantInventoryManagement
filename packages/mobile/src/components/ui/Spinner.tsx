/**
 * Single source spinner used by buttons, screens and lists.
 */
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}

const Spinner = ({ size = 'large', color }: SpinnerProps) => {
  const { theme } = useTheme();
  return <ActivityIndicator size={size} color={color ?? theme.primary[600]} animating />;
};

Spinner.displayName = 'Spinner';
export default Spinner;
