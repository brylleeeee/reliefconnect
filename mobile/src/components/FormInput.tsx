// src/components/FormInput.tsx
import { View, Text, TextInput, TextInputProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, fonts } from '../constants/theme';

type Props = TextInputProps & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function FormInput({ label, style, containerStyle, ...rest }: Props) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
});