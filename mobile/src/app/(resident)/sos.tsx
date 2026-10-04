// src/app/(resident)/sos.tsx  —  "my household needs relief goods", with an optional message about the situation
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useResident } from '../../context/ResidentContext';
import { Sos, cancelSos, fetchActiveSos, sendSos } from '../../data/sos';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

// Quick reasons residents can tap instead of typing (Filipino first, as most residents write)
const QUICK = ['Baha na kami', 'Naipit kami / kailangan ng rescue', 'Walang pagkain at tubig', 'May sakit o sugatan', 'May matanda, buntis o sanggol', 'Nasira ang bahay'];

export default function SosScreen() {
  const { household } = useResident();
  const [active, setActive] = useState<Sos | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [addingDetails, setAddingDetails] = useState(false);

  const addQuick = (q: string) => setMessage((m) => (m.includes(q) ? m : m ? `${m}, ${q}` : q));

  useFocusEffect(useCallback(() => {
    fetchActiveSos().then(setActive).catch(() => {}).finally(() => setLoading(false));
  }, []));

  const send = async () => {
    setBusy(true);
    try {
      setActive(await sendSos(message));
      setMessage('');
      setAddingDetails(false);
    } catch (e) {
      Alert.alert('SOS not sent', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // A confirmation first, so a pocket tap can't send an alert
  const confirmSend = () =>
    Alert.alert('Send SOS?', message.trim()
      ? `The LGU will see that your household needs relief goods, and your message:\n"${message.trim()}"`
      : 'Your barangay and the LGU will see that your household needs relief goods.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: send },
    ]);

  const cancel = () =>
    Alert.alert('Do you still need relief goods?', 'Cancelling withdraws your SOS.', [
      { text: 'Keep SOS', style: 'cancel' },
      { text: 'Cancel SOS', onPress: async () => {
        try { await cancelSos(); setActive(null); } catch (e) { Alert.alert('Could not cancel', errorText(e)); }
      } },
    ]);

  const messageBox = (
    <View style={styles.msgBox}>
      <Text style={styles.label}>What is happening? (optional, but it helps the LGU decide who to help first)</Text>
      <View style={styles.chips}>
        {QUICK.map((q) => (
          <Pressable key={q} style={styles.chip} onPress={() => addQuick(q)}>
            <Text style={styles.chipText}>+ {q}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Hal. Baha na hanggang tuhod, may lola kaming hindi makalakad"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household?.barangay ?? ''} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : active ? (
          <View style={styles.sent}>
            <View style={styles.sentIcon}><TriangleAlert size={28} color={colors.white} /></View>
            <Text style={styles.sentTitle}>SOS sent</Text>
            <Text style={styles.sentText}>
              The LGU can see that your household{household?.barangay ? ` in ${household.barangay}` : ''} needs relief goods.
              Barangays with the most urgent need are served first. Please keep your phone on.
            </Text>
            {active.message ? (
              <View style={styles.sentMsg}>
                <Text style={styles.sentMsgLabel}>Your message</Text>
                <Text style={styles.sentMsgText}>{active.message}</Text>
              </View>
            ) : null}
            {addingDetails ? (
              <View style={{ alignSelf: 'stretch', gap: 10 }}>
                {messageBox}
                <PrimaryButton title={busy ? 'Sending…' : 'Send details'} onPress={send} disabled={busy || !message.trim()} />
              </View>
            ) : (
              <PrimaryButton title="Add details" onPress={() => setAddingDetails(true)} />
            )}
            <PrimaryButton title="Cancel SOS" variant="outline" onPress={cancel} />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.title}>Need relief goods?</Text>
            <Text style={styles.sub}>
              Press the button once. The LGU will know your household needs relief goods.
            </Text>
            {messageBox}
            <Pressable onPress={confirmSend} disabled={busy}
                       style={({ pressed }) => [styles.sosBtn, (pressed || busy) && { opacity: 0.85 }]}>
              {busy ? <ActivityIndicator color={colors.white} size="large" /> : (
                <>
                  <TriangleAlert size={44} color={colors.white} />
                  <Text style={styles.sosText}>SOS</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.note}>Send it once. Pressing again won't make it more urgent.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, flexGrow: 1 },
  center: { alignItems: 'center', gap: 14, paddingTop: 24 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  sosBtn: {
    width: 190, height: 190, borderRadius: 95, backgroundColor: colors.danger, marginVertical: 24,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  sosText: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.white },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  sent: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger, borderRadius: 16, padding: 20, gap: 12, alignItems: 'center' },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.danger },
  sentText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  msgBox: { alignSelf: 'stretch', gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  input: { minHeight: 76, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlignVertical: 'top' },
  sentMsg: { alignSelf: 'stretch', backgroundColor: colors.dangerTint, borderRadius: 10, padding: 10, gap: 2 },
  sentMsgLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.danger },
  sentMsgText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
});
