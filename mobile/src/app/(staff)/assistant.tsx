// src/app/(staff)/assistant.tsx  —  adviser: report field complaints or request technical support
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert, Linking, Platform,
  KeyboardAvoidingView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, MessageSquare } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useStaff } from '../../context/StaffContext';
import { SUPPORT_PHONE, SUPPORT_NAME } from '../../constants/support';
import { colors, fonts } from '../../constants/theme';

const CATEGORIES = ['Technical problem', 'Field complaint', 'Resident concern', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

// Saved on the phone until the backend has a support_tickets table
async function saveRequest(entry: Record<string, unknown>) {
  const raw = await AsyncStorage.getItem('staff_support_requests');
  const list = raw ? JSON.parse(raw) : [];
  list.unshift(entry);
  await AsyncStorage.setItem('staff_support_requests', JSON.stringify(list.slice(0, 50)));
}

export default function Assistant() {
  const { user, selected } = useStaff();
  const [category, setCategory] = useState<Category>('Technical problem');
  const [message, setMessage] = useState('');

  const context = [
    `Staff: ${user?.name ?? 'Unknown'}`,
    selected ? `Distribution: ${selected.name} (Brgy. ${selected.barangay})` : 'Distribution: none selected',
    `Time: ${new Date().toLocaleString('en-PH')}`,
  ].join('\n');

  const send = async () => {
    if (!message.trim()) {
      Alert.alert('Describe the problem', 'Write a short description so support knows how to help.');
      return;
    }
    const body = `[ReliefConnect ${category}]\n${message.trim()}\n\n${context}`;

    await saveRequest({
      category,
      message: message.trim(),
      staffId: user?.id ?? null,
      eventId: selected?.event_id ?? null,
      barangay: selected?.barangay ?? null,
      at: new Date().toISOString(),
      status: 'sent_by_sms',
    }).catch(() => {});

    // Android uses ?body=, iOS uses &body=
    const url = `sms:${SUPPORT_PHONE}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
      setMessage('');
      router.back();
    } catch {
      Alert.alert('Could not open SMS', `Please text ${SUPPORT_PHONE} directly.`);
    }
  };

  const call = () => {
    Alert.alert('Call support?', `${SUPPORT_NAME}\n${SUPPORT_PHONE}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`) },
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
            {CATEGORIES.map((c) => (
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
            placeholder="e.g. Scanner won't read printed QR cards in this hall"
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.contextBox}>
            <Text style={styles.label}>ADDED AUTOMATICALLY</Text>
            <Text style={styles.contextText}>{context}</Text>
          </View>

          <PrimaryButton title="Send via SMS" onPress={send} />
          <View style={styles.noteRow}>
            <MessageSquare size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.note}>Opens your SMS app with the message ready. A copy is saved on this phone.</Text>
          </View>
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
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
});