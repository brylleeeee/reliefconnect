// src/app/report-problem.tsx  —  resident: report a problem to the barangay (e.g. incomplete aid).
// Sent to the barangay admin's website; if there is no internet, it can be sent by SMS instead.
import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert, Linking, Platform,
  KeyboardAvoidingView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Phone } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import ReportCard from '../components/ReportCard';
import Pager from '../components/Pager';
import { usePaged } from '../lib/usePaged';
import { ApiError, errorText } from '../lib/api';
import { useResident } from '../context/ResidentContext';
import { fetchReports, sendReport, RESIDENT_CATEGORIES, SupportReport } from '../data/supportReports';
import { SUPPORT_PHONE, SUPPORT_NAME } from '../constants/support';
import { colors, fonts } from '../constants/theme';

type Category = (typeof RESIDENT_CATEGORIES)[number];

export default function ReportProblem() {
  const { household } = useResident();
  const [category, setCategory] = useState<Category>('Incomplete or missing aid');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [reports, setReports] = useState<SupportReport[] | null>(null);
  const [listError, setListError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setReports(await fetchReports('resident'));
      setListError('');
    } catch (e) {
      setListError(errorText(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  // Built at the moment of sending, so the barangay knows who is reporting even without the app
  const contextLines = () =>
    [
      `Resident: ${household?.headName ?? 'Unknown'}`,
      household?.referenceNumber ? `Reference No.: ${household.referenceNumber}` : null,
      household ? `Address: ${[household.purok, household.address].filter(Boolean).join(', ')}, Brgy. ${household.barangay}` : null,
      `Time: ${new Date().toLocaleString('en-PH')}`,
    ].filter(Boolean).join('\n');

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

  const smsInstead = () => {
    if (!message.trim()) {
      return Alert.alert('Describe the problem', 'Tell your barangay what happened before sending.');
    }
    sendSms();
  };

  const submit = async () => {
    if (!message.trim()) {
      return Alert.alert('Describe the problem', 'Tell your barangay what happened so they can help.');
    }
    setSending(true);
    try {
      await sendReport('resident', { category, message: message.trim() });
      setMessage('');
      Alert.alert('Report sent', 'Your barangay will review it. You will be notified when it is resolved.');
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

  const call = () => {
    Alert.alert('Call the barangay?', `${SUPPORT_NAME}\n${SUPPORT_PHONE}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () =>
          Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() =>
            Alert.alert('Could not start the call', `Please call ${SUPPORT_PHONE} from another phone.`)),
      },
    ]);
  };

  // Past reports sit under the form, 5 per page (no scroll jump, so the list stays in view)
  const reportPages = usePaged(reports, 5);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Report a Problem" subtitle="Tell your barangay what went wrong" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* urgent: call */}
          <Pressable style={({ pressed }) => [styles.callCard, pressed && { opacity: 0.85 }]} onPress={call}>
            <View style={styles.callIcon}>
              <Phone size={20} color={colors.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.callTitle}>Call for Help</Text>
              <Text style={styles.callSub}>For urgent concerns, talk to someone now</Text>
            </View>
          </Pressable>

          <Text style={styles.label}>WHAT IS THIS ABOUT?</Text>
          <View style={styles.chips}>
            {RESIDENT_CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === c && { color: colors.white }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>WHAT HAPPENED?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. I received 1 pack of rice but the announcement said 2 packs per household"
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />

          <PrimaryButton title={sending ? 'Sending…' : 'Send Report'} onPress={submit} disabled={sending} />
          <PrimaryButton title="Send via SMS instead" variant="outline" onPress={smsInstead} disabled={sending} />
          <Text style={styles.note}>
            Your name and household are attached automatically, so your barangay knows who to follow up with.
            No internet? SMS opens your messaging app with the report ready to send.
          </Text>

          {/* the resident's past reports */}
          <Text style={[styles.label, { marginTop: 12 }]}>MY REPORTS</Text>
          {listError ? <Text style={styles.hint}>{listError}</Text> : null}
          {reports === null && !listError && <Text style={styles.hint}>Loading…</Text>}
          {reports?.length === 0 && <Text style={styles.hint}>You haven't sent any reports yet.</Text>}
          {reportPages.rows.map((r) => <ReportCard key={r.id} report={r} />)}
          <Pager meta={reportPages.meta} onPage={reportPages.goTo} />
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  callSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },

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
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});