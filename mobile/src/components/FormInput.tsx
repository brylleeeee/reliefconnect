// src/components/FormInput.tsx
import { forwardRef, type ComponentRef } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, fonts } from '../constants/theme';

type Props = TextInputProps & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
};

// forwardRef so a screen can focus the box (e.g. Manual Entry after "Enter Another")
const FormInput = forwardRef<ComponentRef<typeof TextInput>, Props>(function FormInput({ label, style, containerStyle, ...rest }, ref) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput ref={ref} placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
});

export default FormInput;

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  input: {
    minHeight: 48,
    paddingVertical: 12,
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