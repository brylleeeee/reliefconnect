// src/components/FormInput.tsx
import { forwardRef, useState, type ComponentRef } from 'react';
import { View, Text, TextInput, TextInputProps, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Hides the text and shows an eye button to see or hide it (like the login screens). */
  password?: boolean;
  /** Hides the text without an eye button (when the screen has its own "Show" toggle). */
  secureTextEntry?: boolean;
};

// forwardRef so a screen can focus the box (e.g. Manual Entry after "Enter Another")
const FormInput = forwardRef<ComponentRef<typeof TextInput>, Props>(function FormInput(
  { label, style, containerStyle, password, secureTextEntry, ...rest },
  ref,
) {
  const [shown, setShown] = useState(false);

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          secureTextEntry={password ? !shown : secureTextEntry}
          accessibilityLabel={label}
          style={[styles.input, password && styles.inputWithEye, style]}
          {...rest}
        />
        {password && (
          <Pressable
            onPress={() => setShown((v) => !v)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {shown
              ? <EyeOff size={18} color={colors.textSecondary} strokeWidth={2} />
              : <Eye size={18} color={colors.textSecondary} strokeWidth={2} />}
          </Pressable>
        )}
      </View>
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
  inputWithEye: { paddingRight: 48 }, // the text never runs under the eye
  eye: { position: 'absolute', right: 6, top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' },
});
