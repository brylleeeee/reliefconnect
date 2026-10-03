// src/app/(staff)/manual-entry.tsx  —  type a household's reference number (when the QR can't be scanned)
import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import ScreenHeader from '../../components/ScreenHeader';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { useStaff } from '../../context/StaffContext';
import { colors, fonts } from '../../constants/theme';

export default function ManualEntry() {
  const { selected } = useStaff();
  const [reference, setReference] = useState('');

  const handleCheck = () => {
    const value = reference.trim().toUpperCase();
    if (!value) return Alert.alert('Reference number needed', 'Type the reference number shown on the resident\'s app or slip.');
    router.push({ pathname: '/verification', params: { reference: value, method: 'reference_number' } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Reference Number" subtitle={selected ? `Brgy. ${selected.barangay}` : undefined} />
        <View style={styles.content}>
          <Text style={styles.intro}>
            Use this when the resident has no phone or the QR code can't be scanned. The reference number is on the
            resident's Our QR tab or their printed walk-in slip.
          </Text>
          <FormInput
            label="Household Reference Number"
            placeholder="e.g. URB-2026-000123"
            value={reference}
            onChangeText={(v) => setReference(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleCheck}
          />
        </View>
        <View style={styles.footer}>
          <PrimaryButton title="Check Household" onPress={handleCheck} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});
