// src/app/confirmation.tsx  —  Figma frame: resident-confirmation
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { useResident } from '../context/ResidentContext';
import { colors, fonts } from '../constants/theme';

export default function Confirmation() {
  const { household } = useResident();
  const BARANGAY = household?.barangay ?? 'your barangay';
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Submission Successful"
        subtitle="Application Status"
        onBack={() => router.replace('/home')}
      />

      <View style={styles.content}>
        <View style={styles.badgeOuter}>
          <View style={styles.badgeInner}>
            <Check size={32} color={colors.white} strokeWidth={2} />
          </View>
        </View>

        <Text style={styles.title}>Application Submitted</Text>

        <View style={styles.pill}>
          <Text style={styles.pillText}>Pending QR Approval</Text>
        </View>

        <Text style={styles.body}>
          Your household documentation is being reviewed by the Barangay {BARANGAY} admin. Check the Our QR tab
          for updates; your QR code appears there once approved.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="Continue to App" onPress={() => router.replace('/home')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 84 },

  badgeOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  badgeInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 12 },

  pill: {
    height: 28,
    borderRadius: 20,
    paddingHorizontal: 16,
    backgroundColor: colors.blueTint,
    justifyContent: 'center',
    marginBottom: 12,
  },
  pillText: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.5, color: colors.blue },

  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingBottom: 24 },
});