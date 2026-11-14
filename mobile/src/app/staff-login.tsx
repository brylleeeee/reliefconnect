// src/app/staff-login.tsx  —  barangay distribution staff sign-in, styled like the website login (see AuthLayout)
import { useRef, useState, type ComponentRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Lock, ShieldCheck, UserRound } from 'lucide-react-native';
import AuthLayout, { AuthButton } from '../components/AuthLayout';
import AuthField from '../components/AuthField';
import { login } from '../lib/auth';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      return setError('Enter your username and password.');
    }

    setError('');
    setBusy(true);
    try {
      await login(username, password, 'distribution_personnel');
      router.dismissAll();
      router.replace('/dashboard');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      portal="Barangay staff portal"
      title="Sign in"
      subtitle="Use the staff account your barangay admin gave you."
      error={error}
      footer={
        <View style={styles.secure}>
          <ShieldCheck size={15} color={colors.primary} strokeWidth={2} />
          <Text style={styles.secureText}>For authorized barangay distribution staff only.</Text>
        </View>
      }
    >
      <AuthField
        label="Username"
        icon={UserRound}
        placeholder="e.g. m.santos"
        value={username}
        onChangeText={(v) => { setUsername(v); if (error) setError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
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

      <Text style={styles.help}>
        First time signing in? Change your password afterward. Forgot it? Ask your barangay admin to reset it.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: '#61756C', textAlign: 'center', marginTop: 2 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8 },
  secureText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12.5, color: '#61756C' },
});