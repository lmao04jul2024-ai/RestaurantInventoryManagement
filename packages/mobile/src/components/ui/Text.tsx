/**
 * Typography primitive — variants mirror the web design-token scale.
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption';
type Tone = 'default' | 'muted' | 'primary' | 'inverse' | 'danger';

export interface AppTextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
}

const AppText = ({ variant = 'body', tone = 'default', style, children, ...props }: AppTextProps) => {
  const { theme } = useTheme();

  const variantStyles: Record<Variant, TextStyle> = {
    h1: theme.typography.h1,
    h2: theme.typography.h2,
    h3: theme.typography.h3,
    body: theme.typography.body,
    bodySmall: theme.typography.bodySmall,
    caption: theme.typography.caption,
  };

  const tones: Record<Tone, TextStyle> = {
    default: { color: theme.contentDefault },
    muted: { color: theme.contentMuted },
    primary: { color: theme.primary[600] },
    inverse: { color: theme.surface },
    danger: { color: theme.danger[600] },
  };

  return (
    <RNText style={[variantStyles[variant], tones[tone], style]} {...props}>
      {children}
    </RNText>
  );
};

AppText.displayName = 'Text';
export default AppText;
