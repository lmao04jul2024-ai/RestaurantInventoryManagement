/**
 * Touchable button — parity with the web <Button /> variants/sizes/loading.
 * Built on Pressable because RN's core Button is not stylable.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/ui/Text';
import Spinner from '@/components/ui/Spinner';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) => {
  const { theme } = useTheme();
  const inactive = disabled || isLoading;

  const backgroundColor: Record<Variant, string> = {
    primary: theme.primary[600],
    secondary: theme.secondary[600],
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.danger[600],
  };

  const filledLabelColor = theme.surface;
  const outlineLabelColor = theme.contentDefault;
  const ghostLabelColor = theme.primary[600];
  const labelColor: TextStyle =
    variant === 'outline'
      ? { color: outlineLabelColor }
      : variant === 'ghost'
        ? { color: ghostLabelColor }
        : { color: filledLabelColor };

  const sizeStyle = {
    sm: { paddingVertical: theme.spacing.sm - 2, paddingHorizontal: theme.spacing.lg },
    md: { paddingVertical: theme.spacing.md + 1, paddingHorizontal: theme.spacing.xl - 2 },
    lg: { paddingVertical: theme.spacing.md + 3, paddingHorizontal: theme.spacing['2xl'] },
  }[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: isLoading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: backgroundColor[variant],
          borderRadius: theme.radii.default,
        },
        variant === 'outline' && { borderWidth: 1, borderColor: theme.border },
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {isLoading && <Spinner size="small" color={theme.surface} />}
      <View style={isLoading ? styles.labelGap : undefined}>
        <AppText
          variant={size === 'lg' ? 'body' : 'bodySmall'}
          style={[labelColor, styles.labelWeight]}
        >
          {title}
        </AppText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  labelGap: { marginRight: 8 },
  labelWeight: { fontWeight: '600' },
});

AppButton.displayName = 'Button';
export default AppButton;
