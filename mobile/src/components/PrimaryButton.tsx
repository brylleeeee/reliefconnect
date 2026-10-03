// src/components/PrimaryButton.tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
};

export default function PrimaryButton({ title, onPress, variant = 'solid', disabled }: Props) {
  const outline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        outline ? styles.outline : styles.solid,
        (pressed || disabled) && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.text, { color: outline ? colors.primary : colors.white }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  solid: { backgroundColor: colors.primary },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  text: { fontFamily: fonts.bold, fontSize: 15 },
});