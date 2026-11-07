// src/app/(staff)/assistant.tsx  —  report field problems to the barangay, or call support
import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert, Linking, Platform,
  KeyboardAvoidingView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Phone } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import ReportCard from '../../components/ReportCard';
import { useStaff } from '../../context/StaffContext';
import { ApiError, errorText } from '../../lib/api';
import { fetchReports, sendReport, STAFF_CATEGORIES, SupportReport } from '../../data/supportReports';
import { SUPPORT_PHONE, SUPPORT_NAME } from '../../constants/support';
import { colors, fonts } from '../../constants/theme';

type Category = (typeof STAFF_CATEGORIES)[number];

export default function Assistant() {
  const { user, selected } = useStaff();
  const [category, setCategory] = useState<Category>('Short on goods');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reports, setReports] = useState<SupportReport[] | null>(null);
  const [listError, setListError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setReports(await fetchReports('distribution'));
      setListError('');
    } catch (e) {
      setListError(errorText(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  // Built at the moment of sending, so the time is correct even if writing took a while
  const contextLines = () =>
    [
      `Staff: ${user?.name ?? 'Unknown'}`,
      selected ? `Distribution: ${selected.name} (Brgy. ${selected.barangay})` : 'Distribution: none selected',
      `Time: ${new Date().toLocaleString('en-PH')}`,
    ].join('\n');

  // Backup when there is no internet: opens the SMS app with the report ready
  const sendSms = async () => {
    const body = `[ReliefConnect ${category}]\n${message.trim()}\n\n${contextLines()}`;
    // Android uses ?body=, iOS uses &body=
    const url = `sms:${SUPPORT_PHONE}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open SMS', `Please text ${SUPPORT_PHONE} directly.`);
    }
  };

  const submit = async () => {
    if (!message.trim()) {
      return Alert.alert('Describe the problem', 'Write a short description so your barangay knows how to help.');
    }
    setSending(true);
    try {
      await sendReport('distribution', {
        category,
        message: message.trim(),
        distribution_event_id: selected?.event_id ?? null,
      });
      setMessage('');
      Alert.alert('Report sent', 'Your barangay admin will see it on the website. You will be notified when it is resolved.');
      loadReports();
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        // No connection: offer SMS instead
        Alert.alert('No connection', 'The report could not reach the server. Send it by SMS instead?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send via SMS', onPress: sendSms },
        ]);
      } else {
        Alert.alert('Report not sent', errorText(e));
      }
    } finally {
      setSending(false);
    }
  };

  const smsInstead = () => {
    if (!message.trim()) {
      return Alert.alert('Describe the problem', 'Write a short description before sending.');
    }
    sendSms();
  };

  const call = () => {
    Alert.alert('Call support?', `${SUPPORT_NAME}\n${SUPPORT_PHONE}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () =>
          Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() =>
            Alert.alert('Could not start the call', `This phone cannot make calls. Please call ${SUPPORT_PHONE} from another phone.`)),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Assistant" subtitle="Report a problem or ask for help" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* urgent: call */}
          <Pressable style={({ pressed }) => [styles.callCard, pressed && { opacity: 0.85 }]} onPress={call}>
            <View style={styles.callIcon}>
              <Phone size={22} color={colors.white} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.callTitle}>Call Support Now</Text>
              <Text style={styles.callSub}>For urgent problems during distribution</Text>
            </View>
          </Pressable>

          <Text style={styles.label}>WHAT IS THIS ABOUT?</Text>
          <View style={styles.chips}>
            {STAFF_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === c && { color: colors.white }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>DESCRIBE THE PROBLEM</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. We only received 40 rice packs but the quota is 50"
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <View style={styles.contextBox}>
            <Text style={styles.label}>ADDED AUTOMATICALLY</Text>
            <Text style={styles.contextText}>
              {`Staff: ${user?.name ?? 'Unknown'}\n`}
              {selected ? `Distribution: ${selected.name} (Brgy. ${selected.barangay})\n` : 'Distribution: none selected\n'}
              Time: when you send
            </Text>
          </View>

          <PrimaryButton title={sending ? 'Sending…' : 'Send Report'} onPress={submit} disabled={sending} />
          <PrimaryButton title="Send via SMS instead" variant="outline" onPress={smsInstead} disabled={sending} />

          {/* the staff member's past reports */}
          <Text style={[styles.label, { marginTop: 12 }]}>MY REPORTS</Text>
          {listError ? <Text style={styles.hint}>{listError}</Text> : null}
          {reports === null && !listError && <Text style={styles.hint}>Loading…</Text>}
          {reports?.length === 0 && <Text style={styles.hint}>You haven't sent any reports yet.</Text>}
          {reports?.map((r) => <ReportCard key={r.id} report={r} />)}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },

  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.danger,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  callIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  callSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.white, opacity: 0.9 },

  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },

  input: {
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 14,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },
  contextBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  contextText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});