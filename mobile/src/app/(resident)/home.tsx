// src/app/(resident)/home.tsx  —  adviser: QR shown immediately on launch
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, AppState, Animated, Easing, Pressable, Modal, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { QrCode } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect } from 'expo-router';
import AppHeader from '../../components/AppHeader';
import QrPending from '../../components/QrPending';
import QrApproved from '../../components/QrApproved';
import PrimaryButton from '../../components/PrimaryButton';
import UnreadAnnouncementsModal from '../../components/UnreadAnnouncementsModal';
import { useResident } from '../../context/ResidentContext';
import { colors, fonts } from '../../constants/theme';

const LIVE_CHECK_MS = 10000; // while waiting for review, ask the server every 10 seconds

/** Small dot that softly pulses next to "Checking for updates…" */
function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }],
      }]} />
      <View style={styles.dot} />
    </View>
  );
}

/** "Your QR is ready!" pop-up, shown when the approval arrives while the app is open. */
function QrReadyCelebration({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [visible, pop]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.celebrateBackdrop} onPress={onClose}>
        <Animated.View style={[styles.celebrateCard, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
          <View style={styles.celebrateIcon}>
            <QrCode size={40} color={colors.white} strokeWidth={2} />
          </View>
          <Text style={styles.celebrateTitle}>Your QR is ready! 🎉</Text>
          <Text style={styles.celebrateText}>
            Your barangay approved your household. Show this QR code at the next relief distribution.
          </Text>
          <PrimaryButton title="View my QR" onPress={onClose} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function Home() {
  const { household, refresh } = useResident();
  const [refreshing, setRefreshing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const issued = !!household && household.status === 'approved' && !!household.qrToken && !!household.referenceNumber;
  // Still waiting for the barangay: pending, or approved but the QR not issued yet
  const waiting = !!household && household.status !== 'rejected' && !issued;

  // Check for a new status (approval or rejection) every time the tab is opened
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  // Live update: while waiting and this tab is on screen, keep checking so the QR appears
  // by itself once the barangay approves it (no need to pull down to refresh)
  useFocusEffect(useCallback(() => {
    if (!waiting) return;
    const check = () => { if (AppState.currentState === 'active') refresh().catch(() => {}); };
    const timer = setInterval(check, LIVE_CHECK_MS);
    const appState = AppState.addEventListener('change', (s) => { if (s === 'active') check(); }); // back from another app
    const push = Notifications.addNotificationReceivedListener(check); // e.g. the "QR issued" notification
    return () => { clearInterval(timer); appState.remove(); push.remove(); };
  }, [waiting, refresh]));

  // When the QR arrives while the resident is watching, celebrate it
  const wasWaiting = useRef(waiting);
  useEffect(() => {
    if (wasWaiting.current && issued) setCelebrate(true);
    wasWaiting.current = waiting;
  }, [waiting, issued]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  // not logged in → back to start
  if (!household) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household.barangay} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {household.status === 'rejected' ? (
          <View style={styles.rejected}>
            <Text style={styles.rejectedTitle}>Application not approved</Text>
            <Text style={styles.rejectedText}>
              Barangay {household.barangay} reviewed your application and asked for changes:
            </Text>
            <Text style={styles.reason}>{household.rejectionReason ?? 'No reason given.'}</Text>
            <PrimaryButton title="Update and Resubmit" onPress={() => router.push('/household-step1')} />
          </View>
        ) : issued ? (
          <QrApproved household={household} />
        ) : (
          <>
            <View style={styles.live} accessibilityLiveRegion="polite">
              <LiveDot />
              <Text style={styles.liveText}>Checking for updates automatically. Your QR will appear here once approved.</Text>
            </View>
            <QrPending household={household} />
          </>
        )}
      </ScrollView>

      <UnreadAnnouncementsModal />
      <QrReadyCelebration visible={celebrate} onClose={() => setCelebrate(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },

  live: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.blueTint,
  },
  liveText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.blue },
  dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },

  celebrateBackdrop: { flex: 1, backgroundColor: 'rgba(30,42,47,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  celebrateCard: {
    width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: 24, padding: 24, gap: 10, alignItems: 'stretch',
  },
  celebrateIcon: {
    alignSelf: 'center', width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 6, borderColor: colors.primaryTint,
  },
  celebrateTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, textAlign: 'center' },
  celebrateText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  rejected: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  rejectedTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.danger },
  rejectedText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  reason: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.dangerTint,
    borderRadius: 10,
    padding: 12,
  },
});