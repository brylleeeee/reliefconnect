// src/app/login.tsx  —  resident login (no Figma frame; styled like staff-login)
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Handshake, House, Eye, EyeOff } from 'lucide-react-native';
import PrimaryButton from '../components/PrimaryButton';
import { useResident } from '../context/ResidentContext';
import { sampleHousehold } from '../data/household';
import { colors, fonts } from '../constants/theme';

export default function Login() {
  const { setHousehold } = useResident();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!contact.trim() || !password) {
      return Alert.alert('Missing information', 'Please enter your contact number and password.');
    }
    if (!/^09\d{9}$/.test(contact)) {
      return Alert.alert('Invalid number', 'Enter an 11-digit mobile number starting with 09.');
    }

    // TODO: send contact + password to the Laravel API and check the role is 'resident'
    setHousehold({ ...sampleHousehold, contact });
    router.dismissAll();
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* branding */}
          <View style={styles.branding}>
            <View style={styles.logoBadge}>
              <Handshake size={32} color={colors.white} strokeWidth={2} />
              <House size={18} color={colors.white} strokeWidth={2} />
            </View>
            <Text style={styles.title}>ReliefConnect</Text>
            <Text style={styles.subtitle}>Resident Portal</Text>

            <View style={styles.lguBar}>
              <View style={[styles.pill, { backgroundColor: colors.blue }]} />
              <View style={[styles.pill, { backgroundColor: colors.danger }]} />
              <View style={[styles.pill, { width: 8, backgroundColor: colors.yellow }]} />
              <Text style={styles.lguText}>LGU URBIZTONDO</Text>
            </View>
          </View>

          {/* form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Contact Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 09171234567"
                placeholderTextColor={colors.muted}
                value={contact}
                onChangeText={setContact}
                keyboardType="phone-pad"
                maxLength={11}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordBox}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} strokeWidth={2} />
                  )}
                </Pressable>
              </View>
            </View>

            <PrimaryButton title="Login" onPress={handleLogin} />

            <Pressable hitSlop={8} onPress={() => router.replace('/register')}>
              <Text style={styles.note}>
                Don't have an account? <Text style={styles.noteLink}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },

  branding: { alignItems: 'center', paddingTop: 48 },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.5, color: colors.text, marginTop: 16 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1, color: colors.primary, marginTop: 6 },
  lguBar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16 },
  pill: { width: 16, height: 4, borderRadius: 2 },
  lguText: { fontFamily: fonts.bold, fontSize: 10, color: colors.textSecondary },

  form: { marginTop: 140, gap: 20 },
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, color: colors.textSecondary },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  passwordBox: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  noteLink: { fontFamily: fonts.semibold, color: colors.primary },
});