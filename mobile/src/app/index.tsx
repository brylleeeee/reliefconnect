// src/app/index.tsx  —  start screen, styled like the website login and the sign-in screens (see AuthLayout):
// the green Urbiztondo header with the official seal and rice terraces, then Sign in / Register.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, Animated, AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ShieldCheck, ShieldPlus } from 'lucide-react-native';
import { HeroBackground, Terraces } from '../components/AuthLayout';
import { useResident } from '../context/ResidentContext';
import { currentUser } from '../lib/auth';
import { tokenStore } from '../lib/api';
import { getCachedStaff } from '../lib/offline';
import { colors, fonts } from '../constants/theme';

const SEAL = require('../../assets/images/urbiztondo-seal.png');

export default function ResidentStart() {
  const { setUser, refresh } = useResident();
  const [checking, setChecking] = useState(true);
  const [sealOk, setSealOk] = useState(true);

  // Already logged in on this phone? Skip the login screen.
  useEffect(() => {
    (async () => {
      const user = await currentUser();
      if (user?.role === 'distribution_personnel') return router.replace('/dashboard');
      // Offline mode: a staff phone opened without internet still goes to the dashboard
      if (!user && (await tokenStore.get()) && (await getCachedStaff())) return router.replace('/dashboard');
      if (user?.role === 'resident') {
        setUser(user);
        const household = await refresh().catch(() => null);
        if (household) return router.replace('/home');
        return router.replace({ pathname: '/household-step1', params: { fullName: user.name, contact: user.phone ?? '' } });
      }
      setChecking(false);
    })();
  }, [refresh, setUser]);

  // The terraces settle into place once the screen shows (skipped when the phone asks for less motion)
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (checking) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) rise.setValue(1);
        else Animated.timing(rise, { toValue: 1, duration: 800, delay: 80, useNativeDriver: true }).start();
      });
    return () => { cancelled = true; };
  }, [checking, rise]);

  if (checking) {
    return (
      <View style={[styles.screen, styles.center]}>
        <StatusBar style="light" />
        <HeroBackground />
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* the municipality */}
      <View style={styles.hero}>
        <HeroBackground />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <Text style={styles.republic}>Republic of the Philippines</Text>

          <View style={styles.brand}>
            <View style={styles.sealRing}>
              <View style={styles.seal}>
                {sealOk ? (
                  <Image
                    source={SEAL}
                    style={styles.sealImage}
                    onError={() => setSealOk(false)}
                    accessibilityLabel="Seal of the Municipality of Urbiztondo"
                  />
                ) : (
                  <ShieldPlus size={44} color={colors.primary} strokeWidth={2} />
                )}
              </View>
            </View>

            <Text style={styles.province}>Province of Pangasinan</Text>
            <Text style={styles.municipality}>Municipality of Urbiztondo</Text>

            <Text style={styles.app} accessibilityRole="header">ReliefConnect</Text>
            <Text style={styles.tagline}>Relief distribution & beneficiary tracking</Text>
          </View>
        </SafeAreaView>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.terraces,
            { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
          ]}
        >
          <Terraces />
        </Animated.View>
      </View>

      {/* choose how to continue */}
      <SafeAreaView edges={['bottom']} style={styles.actions}>
        <Text style={styles.portal}>Resident portal</Text>

        <Pressable
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryText}>Sign in</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/register')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnOutline, pressed && { backgroundColor: colors.mist }]}
        >
          <Text style={styles.btnOutlineText}>Register</Text>
        </Pressable>

        <Pressable
          hitSlop={8}
          onPress={() => router.push('/staff-login')}
          accessibilityRole="link"
          style={styles.staff}
        >
          <ShieldCheck size={15} color={colors.primary} strokeWidth={2} />
          <Text style={styles.staffText}>
            Barangay staff? <Text style={styles.staffLink}>Sign in here</Text>
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest },

  hero: { flex: 1, overflow: 'hidden', backgroundColor: colors.forest, paddingBottom: 110 },
  republic: {
    fontFamily: fonts.medium, fontSize: 12, color: colors.sprout, textAlign: 'center', marginTop: 14,
  },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  sealRing: { padding: 6, borderRadius: 66, backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 18 },
  seal: {
    width: 108, height: 108, borderRadius: 54, backgroundColor: colors.white,
    borderWidth: 3, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8,
  },
  sealImage: { width: 96, height: 96, borderRadius: 48 },

  province: { fontFamily: fonts.regular, fontSize: 13, color: colors.sprout },
  municipality: { fontFamily: fonts.serifSemibold, fontSize: 20, lineHeight: 26, color: colors.white, marginTop: 2 },

  app: {
    fontFamily: fonts.serifBold, fontSize: 44, lineHeight: 52, letterSpacing: -0.8, color: colors.white,
    marginTop: 22, textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.82)',
    textAlign: 'center', marginTop: 4,
  },

  terraces: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 },

  actions: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, gap: 14 },
  portal: {
    fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: '#61756C', textAlign: 'center',
  },
  btnPrimary: {
    minHeight: 52, borderRadius: 12, backgroundColor: colors.pine, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.pine, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
  },
  btnPrimaryPressed: { backgroundColor: colors.primary, transform: [{ translateY: 1 }] },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  btnOutline: {
    minHeight: 52, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.pine,
    alignItems: 'center', justifyContent: 'center',
  },
  btnOutlineText: { fontFamily: fonts.bold, fontSize: 15, color: colors.pine },

  staff: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  staffText: { fontFamily: fonts.regular, fontSize: 13, color: '#61756C' },
  staffLink: { fontFamily: fonts.semibold, color: colors.primary },
});