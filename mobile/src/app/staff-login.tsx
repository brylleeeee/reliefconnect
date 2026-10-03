// src/app/staff-login.tsx  —  Figma frame: staff-login
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Handshake, Eye, EyeOff } from 'lucide-react-native';
import PrimaryButton from '../components/PrimaryButton';
import { login } from '../lib/auth';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      return Alert.alert('Missing information', 'Please enter your username and password.');
    }

    setBusy(true);
    try {
      await login(username, password, 'distribution_personnel');
      router.dismissAll();
      router.replace('/dashboard');
    } catch (e) {
      Alert.alert('Login failed', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* branding */}
          <View style={styles.branding}>
            <View style={styles.logoBadge}>
              <Handshake size={40} color={colors.white} strokeWidth={2} />
            </View>
            <Text style={styles.title}>ReliefConnect</Text>
            <Text style={styles.subtitle}>Barangay Staff Portal</Text>

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
              <Text style={styles.label}>Staff Username</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. m.santos_batancaoa"
                placeholderTextColor={colors.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
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

            <PrimaryButton title={busy ? 'Logging in…' : 'Login to Portal'} onPress={handleLogin} disabled={busy} />

            <Text style={styles.note}>First time? Change your password after logging in.</Text>
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
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: { flex: 1, height: '100%', fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});