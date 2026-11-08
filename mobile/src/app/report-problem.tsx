// src/app/report-problem.tsx  —  resident: report a problem to the barangay (e.g. incomplete aid)
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
import { errorText } from '../lib/api';
import { fetchReports, sendReport, RESIDENT_CATEGORIES, SupportReport } from '../data/supportReports';
import { SUPPORT_PHONE, SUPPORT_NAME } from '../constants/support';
import { colors, fonts } from '../constants/theme';

type Category = (typeof RESIDENT_CATEGORIES)[number];

export default function ReportProblem() {
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
      Alert.alert('Report not sent', errorText(e));
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
          <Text style={styles.note}>
            Your name and household are attached automatically, so your barangay knows who to follow up with.
          </Text>

          {/* the resident's past reports */}
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