/**
 * Labeled text input with error/helper text — parity with web ui/Input.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  helperText?: string;
  containerStyle?: ViewStyle;
}

const Input = ({ label, error, helperText, containerStyle, style, ...textInputProps }: InputProps) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? theme.danger[500]
    : isFocused
      ? theme.primary[500]
      : theme.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <AppText variant="caption" tone="muted" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...textInputProps}
        placeholderTextColor={theme.contentMuted}
        onFocus={(e) => {
          setIsFocused(true);
          textInputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          textInputProps.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor,
            color: theme.contentDefault,
            borderRadius: theme.radii.default,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.helper}>
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" tone="muted" style={styles.helper}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { marginBottom: 6 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  helper: { marginTop: 6 },
});

Input.displayName = 'Input';
export default Input;
