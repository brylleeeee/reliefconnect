// src/components/QrPending.tsx  —  Figma frame: resident-qr-pending
import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LoaderCircle, Check } from 'lucide-react-native';
import { Household, Step, StepStatus, getSteps } from '../data/household';
import { colors, fonts } from '../constants/theme';

const STEP_STYLES: Record<StepStatus, { circle: string; badgeBg: string; badgeText: string; label: string }> = {
  completed: { circle: colors.primary, badgeBg: colors.primaryTint, badgeText: colors.primary, label: 'COMPLETED' },
  in_progress: { circle: colors.blue, badgeBg: colors.blueTint, badgeText: colors.blue, label: 'IN PROGRESS' },
  pending: { circle: colors.border, badgeBg: colors.border, badgeText: colors.textSecondary, label: 'PENDING' },
};

function TimelineStep({ step, isLast }: { step: Step; isLast: boolean }) {
  const s = STEP_STYLES[step.status];

  return (
    <View style={styles.step}>
      {/* circle + connecting line */}
      <View style={styles.rail}>
        <View style={[styles.circle, { backgroundColor: s.circle }]}>
          {step.status === 'completed' ? (
            <Check size={12} color={colors.white} strokeWidth={3} />
          ) : (
            <View style={[styles.dot, { backgroundColor: step.status === 'in_progress' ? colors.white : colors.muted }]} />
          )}
        </View>
        {!isLast && (
          <View style={[styles.line, { backgroundColor: step.status === 'completed' ? colors.primary : colors.border }]} />
        )}
      </View>

      {/* text */}
      <View style={[styles.stepText, !isLast && { paddingBottom: 20 }]}>
        <View style={styles.stepTitleRow}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <View style={[styles.badge, { backgroundColor: s.badgeBg }]}>
            <Text style={[styles.badgeText, { color: s.badgeText }]}>{s.label}</Text>
          </View>
        </View>
        {step.description ? <Text style={styles.stepDesc}>{step.description}</Text> : null}
      </View>
    </View>
  );
}

export default function QrPending({ household }: { household: Household }) {
  // spinning loader animation
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const steps = getSteps(household.status);

  return (
    <View style={styles.container}>
      {/* illustration card */}
      <View style={styles.illustrationCard}>
        <View style={styles.loaderCircle}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <LoaderCircle size={40} color={colors.primary} strokeWidth={2} />
          </Animated.View>
        </View>
        <View style={styles.headingGroup}>
          <Text style={styles.heading}>Pending QR Application</Text>
          <Text style={styles.subheading}>
            Your household QR code is currently being validated by Barangay {household.barangay} administrators.
          </Text>
        </View>
      </View>

      {/* status timeline */}
      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Application Status</Text>
        <View>
          {steps.map((step, i) => (
            <TimelineStep key={step.title} step={step} isLast={i === steps.length - 1} />
          ))}
        </View>
      </View>

      {/* yellow notice */}
      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>⚠️</Text>
        <Text style={styles.noticeText}>
          Please ensure your head of household name matches your submitted government ID to avoid delays in approval.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },

  illustrationCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  loaderCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingGroup: { alignItems: 'center', gap: 8 },
  heading: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  subheading: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },

  timelineCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  timelineTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5, color: colors.text },

  step: { flexDirection: 'row', gap: 16 },
  rail: { width: 24, alignItems: 'center' },
  circle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1 },
  stepText: { flex: 1, gap: 2 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, height: 15, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 9 },
  stepDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },

  notice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 12,
    padding: 12,
  },
  noticeIcon: { fontSize: 15 },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});