// src/app/login.tsx  —  resident sign-in, styled like the website login (see AuthLayout)
import { useRef, useState, type ComponentRef } from 'react';
import { Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Lock, Smartphone } from 'lucide-react-native';
import AuthLayout, { AuthButton } from '../components/AuthLayout';
import AuthField from '../components/AuthField';
import { useResident } from '../context/ResidentContext';
import { login } from '../lib/auth';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function Login() {
  const { setUser, refresh } = useResident();
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const handleLogin = async () => {
    if (!contact.trim() || !password) {
      return setError('Enter your contact number and password.');
    }
    if (!/^09\d{9}$/.test(contact)) {
      return setError('Enter an 11-digit mobile number starting with 09.');
    }

    setError('');
    setBusy(true);
    try {
      const user = await login(contact, password, 'resident');
      setUser(user);
      const household = await refresh();
      router.dismissAll();
      // No household yet (e.g. closed the app after signing up): continue the registration
      if (household) router.replace('/home');
      else router.replace({ pathname: '/household-step1', params: { fullName: user.name, contact } });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      portal="Resident portal"
      title="Sign in"
      subtitle="Use the mobile number you registered with."
      error={error}
      footer={
        <Pressable hitSlop={8} onPress={() => router.replace('/register')} accessibilityRole="link">
          <Text style={styles.note}>
            Don't have an account? <Text style={styles.link}>Register</Text>
          </Text>
        </Pressable>
      }
    >
      <AuthField
        label="Contact number"
        icon={Smartphone}
        placeholder="e.g. 09171234567"
        value={contact}
        onChangeText={(v) => { setContact(v.replace(/[^0-9]/g, '')); if (error) setError(''); }}
        keyboardType="phone-pad"
        maxLength={11}
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        icon={Lock}
        password
        placeholder="Enter your password"
        value={password}
        onChangeText={(v) => { setPassword(v); if (error) setError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <AuthButton title="Sign in" busyTitle="Signing in…" busy={busy} onPress={handleLogin} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.regular, fontSize: 14, color: '#61756C', textAlign: 'center' },
  link: { fontFamily: fonts.semibold, color: colors.primary },
});