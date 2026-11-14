// src/app/notification-preferences.tsx  —  resident: which notifications pop up on the phone
import { useCallback, useRef, useState, type ComponentType } from 'react';
import { View, Text, Switch, ScrollView, Pressable, Linking, ActivityIndicator, AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  CalendarClock, Megaphone, House, Siren, MessageSquareWarning, ShieldCheck, Lock, BellOff, BellRing,
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { fetchPrefs, savePrefs, NotificationPrefs, PrefCategory } from '../data/notificationPreferences';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TYPES: { key: PrefCategory; label: string; hint: string; Icon: IconType }[] = [
  { key: 'distributions', label: 'Distributions', hint: 'Schedules, distribution started or ended, reminders to claim', Icon: CalendarClock },
  { key: 'announcements', label: 'Announcements', hint: 'News and advisories from your barangay', Icon: Megaphone },
  { key: 'household', label: 'My household', hint: 'Approval, aid released, update requests', Icon: House },
  { key: 'sos', label: 'SOS updates', hint: 'Your SOS was received, relief is on the way', Icon: Siren },
  { key: 'reports', label: 'Report updates', hint: 'Your barangay resolved your report', Icon: MessageSquareWarning },
];

type PhoneStatus = 'allowed' | 'blocked' | 'unknown';

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [phone, setPhone] = useState<PhoneStatus>('unknown');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const saved = useRef<NotificationPrefs | null>(null); // last version the server accepted

  const checkPhone = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((p) => setPhone(p.granted ? 'allowed' : 'blocked'))
      .catch(() => setPhone('unknown'));
  }, []);

  useFocusEffect(useCallback(() => {
    fetchPrefs()
      .then((p) => { setPrefs(p); saved.current = p; setError(''); })
      .catch((e) => setError(errorText(e)));
    checkPhone();
    // Coming back from the phone's Settings app: check the permission again
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkPhone(); });
    return () => sub.remove();
  }, [checkPhone]));

  // Saves right away; if the server refuses, the switches go back to what is really saved
  const update = async (next: NotificationPrefs) => {
    setPrefs(next);
    setSaving(true);
    try {
      const res = await savePrefs(next);
      setPrefs(res);
      saved.current = res;
      setError('');
    } catch (e) {
      setPrefs(saved.current);
      setError(`Not saved: ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (key: PrefCategory, on: boolean) => {
    if (!prefs) return;
    const muted = on ? prefs.muted.filter((k) => k !== key) : [...prefs.muted, key];
    update({ ...prefs, muted });
  };

  const allowOnPhone = async () => {
    const res = await Notifications.requestPermissionsAsync().catch(() => null);
    if (res?.granted) setPhone('allowed');
    else Linking.openSettings(); // Android/iOS only ask once; after that it's in Settings
  };

  const sendTest = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ReliefConnect notifications are on',
        body: 'This is how updates about distributions, your household and your SOS will appear.',
        sound: 'default',
      },
      trigger: null, // show now
    });
    setTestSent(true);
  };

  const on = prefs?.enabled ?? true;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Notification Preferences" subtitle={saving ? 'Saving…' : undefined} />

      <ScrollView contentContainerStyle={styles.content}>
        {phone === 'blocked' && (
          <View style={styles.warning}>
            <View style={styles.warningHead}>
              <BellOff size={18} color={colors.danger} strokeWidth={2} />
              <Text style={styles.warningTitle}>Notifications are blocked on this phone</Text>
            </View>
            <Text style={styles.warningText}>
              Nothing can pop up until you allow notifications for ReliefConnect. The bell inside the app still works.
            </Text>
            <PrimaryButton title="Allow Notifications" variant="outline" onPress={allowOnPhone} />
          </View>
        )}

        {!prefs ? (
          error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* main switch */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.iconBg, { backgroundColor: on ? colors.primaryTint : colors.background }]}>
                  <BellRing size={20} color={on ? colors.primary : colors.muted} strokeWidth={2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Phone notifications</Text>
                  <Text style={styles.hint}>Pop-ups and the notification bar, even when the app is closed</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={(v) => update({ ...prefs, enabled: v })}
                  disabled={saving}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                  accessibilityLabel="Phone notifications"
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* per type */}
            <Text style={styles.section}>NOTIFY ME ABOUT</Text>
            <View style={[styles.card, !on && styles.dim]}>
              {TYPES.map(({ key, label, hint, Icon }, i) => {
                const typeOn = !prefs.muted.includes(key);
                return (
                  <View key={key} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.iconBg}>
                      <Icon size={18} color={colors.primary} strokeWidth={2} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.label}>{label}</Text>
                      <Text style={styles.hint}>{hint}</Text>
                    </View>
                    <Switch
                      value={on && typeOn}
                      onValueChange={(v) => toggleType(key, v)}
                      disabled={!on || saving}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      thumbColor={colors.white}
                      accessibilityLabel={label}
                    />
                  </View>
                );
              })}

              {/* always on */}
              <View style={[styles.row, styles.divider]}>
                <View style={styles.iconBg}>
                  <ShieldCheck size={18} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>Account security</Text>
                  <Text style={styles.hint}>New login on your account, QR code reset. Always on, to protect your account.</Text>
                </View>
                <Lock size={18} color={colors.muted} strokeWidth={2} accessibilityLabel="Always on" />
              </View>
            </View>

            <Text style={styles.note}>
              Everything still appears in the bell list inside the app. These settings only change what pops up on your phone.
            </Text>

            <PrimaryButton title={testSent ? 'Test Sent: Check Your Phone' : 'Send a Test Notification'} variant="outline"
                           onPress={sendTest} disabled={phone === 'blocked'} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12, paddingBottom: 32 },

  warning: { backgroundColor: colors.dangerTint, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, gap: 10 },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.danger },
  warningText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },

  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  iconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },

  section: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, color: colors.textSecondary, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
});
