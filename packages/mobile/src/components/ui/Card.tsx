/**
 * Elevated surface container — mirrors web ui/Card. Optional onPress wraps in
 * a Pressable for tappable cards.
 */
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
}

const Card = ({ children, onPress, padded = true, style }: CardProps) => {
  const { theme } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: theme.radii.card,
    padding: padded ? theme.spacing.lg : 0,
    ...theme.shadows.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },
});

Card.displayName = 'Card';
export default Card;
