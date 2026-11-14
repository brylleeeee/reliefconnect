// src/components/AuthLayout.tsx  —  shared look of the resident and staff sign-in screens, matching the
// website login: a green municipality header (official seal, Urbiztondo, ReliefConnect) that ends in a
// strip of rice terraces, then a white sign-in card.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Image, Pressable, ScrollView, KeyboardAvoidingView, Platform, Animated, AccessibilityInfo,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, G } from 'react-native-svg';
import { ChevronLeft, ShieldPlus } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

const SEAL = require('../../assets/images/urbiztondo-seal.png');

/** Rice terraces seen from above, the same shapes as the website login. */
const TERRACES = [
  'M0 118 C130 88 270 150 410 116 S690 78 800 108',
  'M0 178 C150 146 300 208 460 174 S705 142 800 170',
  'M0 238 C140 212 320 266 485 232 S722 206 800 230',
  'M0 298 C170 272 335 324 525 292 S735 268 800 292',
  'M0 356 C160 334 362 376 545 350 S742 332 800 352',
];
const TERRACE_FILL = [
  { fill: '#3F8B69', opacity: 0.55 },
  { fill: '#36805F', opacity: 0.78 },
  { fill: colors.primary, opacity: 1 },
  { fill: '#22664F', opacity: 1 },
  { fill: colors.pine, opacity: 1 },
];

function Terraces() {
  return (
    <Svg width="100%" height="100%" viewBox="0 80 800 340" preserveAspectRatio="none">
      {TERRACES.map((d, i) => (
        <G key={d}>
          <Path d={`${d} L800 420 L0 420 Z`} fill={TERRACE_FILL[i].fill} opacity={TERRACE_FILL[i].opacity} />
          <Path d={d} transform="translate(0 16)" fill="none" stroke={colors.sprout} strokeOpacity={0.09} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <Path d={d} fill="none" stroke={colors.sprout} strokeOpacity={0.26} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </G>
      ))}
    </Svg>
  );
}

/** Deep forest green with a soft light in the top-right corner, like the website panel. */
function HeroBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="forest" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={colors.pine} />
          <Stop offset="0.75" stopColor={colors.forest} />
        </LinearGradient>
        <RadialGradient id="glow" cx="90%" cy="0%" rx="80%" ry="70%">
          <Stop offset="0" stopColor={colors.paddy} stopOpacity={0.35} />
          <Stop offset="1" stopColor={colors.paddy} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#forest)" />
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

type Props = {
  /** Which app this is, under the ReliefConnect name, e.g. "Resident portal". */
  portal: string;
  title: string;
  subtitle: string;
  /** Shown above the fields, e.g. a wrong password. */
  error?: string;
  /** The fields and the sign-in button. */
  children: ReactNode;
  /** Small text under the card, e.g. "Don't have an account? Register". */
  footer?: ReactNode;
};

export default function AuthLayout({ portal, title, subtitle, error, children, footer }: Props) {
  const [sealOk, setSealOk] = useState(true);

  // One moment on open: the terraces settle into place (skipped when the phone asks for less motion)
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) rise.setValue(1);
        else Animated.timing(rise, { toValue: 1, duration: 800, delay: 80, useNativeDriver: true }).start();
      });
    return () => { cancelled = true; };
  }, [rise]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* the municipality */}
          <View style={styles.hero}>
            <HeroBackground />
            <SafeAreaView edges={['top']}>
              <View style={styles.heroInner}>
                <View style={styles.topRow}>
                  {router.canGoBack() ? (
                    <Pressable
                      onPress={() => router.back()}
                      hitSlop={10}
                      style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Go back"
                    >
                      <ChevronLeft size={20} color={colors.white} strokeWidth={2} />
                    </Pressable>
                  ) : null}
                  <Text style={styles.republic}>Republic of the Philippines</Text>
                </View>

                <View style={styles.lgu}>
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
                        <ShieldPlus size={30} color={colors.primary} strokeWidth={2} />
                      )}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.province}>Province of Pangasinan</Text>
                    <Text style={styles.municipality}>Municipality of Urbiztondo</Text>
                  </View>
                </View>

                <Text style={styles.app} accessibilityRole="header">ReliefConnect</Text>
                <Text style={styles.portal}>{portal}</Text>
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

          {/* sign in */}
          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              {error ? (
                <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fields}>{children}</View>
            </View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The sign-in button: pine green, lighter while pressed, with a spinner while signing in. */
export function AuthButton({ title, busyTitle, busy, onPress }: {
  title: string; busyTitle: string; busy?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      style={({ pressed }) => [styles.button, pressed && !busy && styles.buttonPressed, busy && { opacity: 0.75 }]}
    >
      {busy ? <ActivityIndicator color={colors.white} size="small" /> : null}
      <Text style={styles.buttonText}>{busy ? busyTitle : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mist },
  scroll: { flexGrow: 1 },

  hero: { overflow: 'hidden', backgroundColor: colors.forest, paddingBottom: 104 },
  heroInner: { paddingHorizontal: 22, paddingTop: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  back: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  republic: { fontFamily: fonts.medium, fontSize: 12, color: colors.sprout },

  lgu: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  sealRing: {
    padding: 4, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.10)',
  },
  seal: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white,
    borderWidth: 2.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  sealImage: { width: 56, height: 56, borderRadius: 28 },
  province: { fontFamily: fonts.regular, fontSize: 13, color: colors.sprout },
  municipality: { fontFamily: fonts.serifSemibold, fontSize: 19, lineHeight: 24, color: colors.white, marginTop: 1 },

  app: { fontFamily: fonts.serifBold, fontSize: 38, lineHeight: 44, letterSpacing: -0.6, color: colors.white, marginTop: 22 },
  portal: { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 2 },

  terraces: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92 },

  body: { flex: 1, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 28, gap: 18 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFECE5',
    borderTopWidth: 4,
    borderTopColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  title: { fontFamily: fonts.serifSemibold, fontSize: 24, lineHeight: 30, color: '#17251F' },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: '#61756C', marginTop: 4 },
  error: {
    marginTop: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#FDF0EE', borderWidth: 1, borderColor: '#F4CFC8',
  },
  errorText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: '#A3301F' },
  fields: { marginTop: 20, gap: 16 },

  footer: { alignItems: 'center', gap: 10 },

  button: {
    minHeight: 50, borderRadius: 12, backgroundColor: colors.pine, marginTop: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20,
    shadowColor: colors.pine, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
  },
  buttonPressed: { backgroundColor: colors.primary, transform: [{ translateY: 1 }] },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});