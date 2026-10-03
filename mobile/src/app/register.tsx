// src/app/register.tsx  —  Figma frame: resident-register
import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import FormInput from '../components/FormInput';
import PrimaryButton from '../components/PrimaryButton';
import { useResident } from '../context/ResidentContext';
import { register } from '../lib/auth';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const { setUser } = useResident();

  const handleSubmit = async () => {
    if (!fullName.trim() || !contact.trim() || !password || !confirm) {
      return Alert.alert('Missing information', 'Please fill in all fields.');
    }
    if (!/^09\d{9}$/.test(contact)) {
      return Alert.alert('Invalid number', 'Enter an 11-digit mobile number starting with 09.');
    }
    if (password.length < 8) {
      return Alert.alert('Password too short', 'Password must be at least 8 characters.');
    }
    if (password !== confirm) {
      return Alert.alert('Passwords do not match', 'Please re-enter your password.');
    }

    setBusy(true);
    try {
      const user = await register(fullName, contact, password);
      setUser(user);
      router.replace({ pathname: '/household-step1', params: { fullName: user.name, contact } });
    } catch (e) {
      Alert.alert('Could not create account', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Resident Registration" subtitle="Create Account" />

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <FormInput
            label="Full Name (Head of Household)"
            placeholder="e.g. Juan dela Cruz"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <FormInput
            label="Contact Number"
            placeholder="e.g. 09171234567"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            maxLength={11}
          />
          <FormInput
            label="Password"
            placeholder="Minimum 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <FormInput
            label="Confirm Password"
            placeholder="Repeat password to verify"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          <View style={styles.disclaimer}>
            <Info size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.disclaimerText}>
              By registering, you agree that all provided data is true and subject to LGU validation.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title={busy ? 'Creating account…' : 'Create Account'} onPress={handleSubmit} disabled={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 16 },
  disclaimer: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingBottom: 24 },
});