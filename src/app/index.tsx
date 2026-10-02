// src/app/index.tsx  —  Figma frame: resident-start
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Handshake, House } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

export default function ResidentStart() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Logo + branding */}
      <View style={styles.brandArea}>
        <View style={styles.logoBadge}>
          <Handshake size={32} color={colors.white} strokeWidth={2} />
          <House size={20} color={colors.white} strokeWidth={2} />
        </View>

        <Text style={styles.title}>ReliefConnect</Text>
        <Text style={styles.subtitle}>Relief distribution & beneficiary tracking</Text>

        <View style={styles.lguBar}>
          <View style={[styles.pill, { backgroundColor: colors.blue }]} />
          <View style={[styles.pill, { backgroundColor: colors.danger }]} />
          <View style={[styles.pill, { width: 12, backgroundColor: colors.yellow }]} />
          <Text style={styles.lguText}>LGU URBIZTONDO</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.actions}>
        <Text style={styles.portalNote}>RESIDENT PORTAL</Text>

        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.btnPrimaryText}>Login</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.btnOutlineText}>Register</Text>
        </Pressable>

        {/* Staff entry point (not in Figma) */}
        <Pressable hitSlop={8} onPress={() => router.push('/staff-login')}>
          <Text style={styles.staffLink}>
            Barangay staff? <Text style={styles.staffLinkBold}>Log in here</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  brandArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  lguBar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { width: 24, height: 4, borderRadius: 2 },
  lguText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },

  actions: { paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  portalNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  btnPrimary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  btnOutline: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  staffLink: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  staffLinkBold: { fontFamily: fonts.semibold, color: colors.primary },
  pressed: { opacity: 0.85 },
});