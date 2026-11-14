// src/components/PrimaryButton.tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/theme';

type Variant = 'solid' | 'outline' | 'danger' | 'dangerOutline';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
};

const LOOK: Record<Variant, { box: object; text: string }> = {
  solid: { box: { backgroundColor: colors.primary }, text: colors.white },
  outline: { box: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary }, text: colors.primary },
  danger: { box: { backgroundColor: colors.danger }, text: colors.white },
  dangerOutline: { box: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.danger }, text: colors.danger },
};

export default function PrimaryButton({ title, onPress, variant = 'solid', disabled }: Props) {
  const look = LOOK[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        look.box,
        // pressed and disabled used to look the same; disabled is now clearly faded
        disabled ? styles.disabled : pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, { color: look.text }]} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
  text: { fontFamily: fonts.bold, fontSize: 15 },
});
