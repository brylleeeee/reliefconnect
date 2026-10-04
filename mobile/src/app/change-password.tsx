// src/app/change-password.tsx  —  residents (Account tab) and staff (tap your name on the dashboard)
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ScreenHeader from '../components/ScreenHeader';
import FormInput from '../components/FormInput';
import PrimaryButton from '../components/PrimaryButton';
import { changePassword } from '../lib/auth';
import { ApiError, errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Same rules as the server, checked here first so mistakes show right away
  const check = () => {
    const e: Record<string, string> = {};
    if (!current) e.current_password = 'Enter your current password.';
    if (password.length < 8) e.password = 'The new password must be at least 8 characters.';
    else if (password === current) e.password = 'Choose a new password that is different from your current one.';
    else if (password !== confirm) e.password_confirmation = 'The new passwords do not match.';
    return e;
  };

  const save = async () => {
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await changePassword(current, password, confirm);
      Alert.alert('Password changed', 'Use your new password next time you log in. Other phones logged in to this account were logged out.');
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        // e.g. "Your current password is incorrect." under the right field
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      } else {
        Alert.alert('Could not change password', errorText(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string) => (errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Change Password" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Use at least 8 characters. If someone else set your password (for example at the barangay hall), change it now.
          </Text>

          <View>
            <FormInput label="Current password" value={current} onChangeText={setCurrent}
              secureTextEntry={!show} autoCapitalize="none" autoComplete="current-password" />
            {field('current_password')}
          </View>
          <View>
            <FormInput label="New password" value={password} onChangeText={setPassword}
              secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" />
            {field('password')}
          </View>
          <View>
            <FormInput label="Confirm new password" value={confirm} onChangeText={setConfirm}
              secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" />
            {field('password_confirmation')}
          </View>

          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
            <Text style={styles.toggle}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title={saving ? 'Saving…' : 'Change Password'} onPress={save} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger, marginTop: 6 },
  toggle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  footer: { padding: 20, paddingTop: 8 },
});
