// src/components/AuthField.tsx  —  a sign-in field: label, icon on the left, green outline while typing,
// and an optional show/hide button for passwords. Matches the website login fields.
import { forwardRef, useState, type ComponentRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  icon: LucideIcon;
  /** A password: hidden, with a show/hide button. */
  password?: boolean;
};

const AuthField = forwardRef<ComponentRef<typeof TextInput>, Props>(function AuthField(
  { label, icon: Icon, password, onFocus, onBlur, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const iconColor = focused ? colors.primary : '#8AA497';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <View style={styles.icon}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
        </View>
        <TextInput
          ref={ref}
          placeholderTextColor="#9AAFA4"
          style={[styles.input, style]}
          secureTextEntry={password && !shown}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          accessibilityLabel={label}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setShown((v) => !v)}
            hitSlop={10}
            style={({ pressed }) => [styles.toggle, pressed && { backgroundColor: colors.mist }]}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          >
            {shown
              ? <EyeOff size={18} color="#7C9488" strokeWidth={2} />
              : <Eye size={18} color="#7C9488" strokeWidth={2} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

export default AuthField;

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: '#17251F' },
  box: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D3E3DA',
    backgroundColor: '#FBFDFC',
  },
  // A thicker green outline while typing (stands in for the website's focus glow)
  boxFocused: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.white },
  // Fixed width so a long text box can never squeeze the icon away
  icon: { width: 20, alignItems: 'center', flexShrink: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 12,
    paddingRight: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#17251F',
  },
  toggle: { flexShrink: 0, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});