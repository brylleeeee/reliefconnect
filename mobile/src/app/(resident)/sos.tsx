// src/app/(resident)/sos.tsx  —  "my household needs relief goods", with an optional message about the situation
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert, CircleX } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import ConfirmDialog, { confirmText } from '../../components/ConfirmDialog';
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
  const [asking, setAsking] = useState<'send' | 'cancel' | null>(null); // which confirmation is open

  // Tap a reason to add it, tap it again to remove it
  const toggleQuick = (q: string) =>
    setMessage((m) => {
      if (!m.includes(q)) return m ? `${m}, ${q}` : q;
      return m.split(', ').filter((part) => part !== q).join(', ');
    });

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

  // A confirmation first, so a pocket tap can't send an alert (app-styled dialog, not Android's plain Alert)
  const confirmSend = () => setAsking('send');
  const cancel = () => setAsking('cancel');

  const doCancel = async () => {
    try {
      await cancelSos();
      setActive(null);
    } catch (e) {
      Alert.alert('Could not cancel', errorText(e));
    }
  };

  const messageBox = (
    <View style={styles.msgBox}>
      <Text style={styles.label}>What is happening? (optional, but it helps the LGU decide who to help first)</Text>
      <View style={styles.chips}>
        {QUICK.map((q) => {
          const on = message.includes(q);
          return (
            <Pressable
              key={q}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
              onPress={() => toggleQuick(q)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓' : '+'} {q}</Text>
            </Pressable>
          );
        })}
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
            {/* full-width buttons (they used to shrink to the size of their text) */}
            <View style={styles.actions}>
              {addingDetails ? (
                <>
                  {messageBox}
                  <PrimaryButton title={busy ? 'Sending…' : 'Send details'} onPress={send} disabled={busy || !message.trim()} />
                  <PrimaryButton title="Never mind" variant="outline" onPress={() => { setAddingDetails(false); setMessage(''); }} />
                </>
              ) : (
                <PrimaryButton title="Add details" onPress={() => setAddingDetails(true)} />
              )}
              <PrimaryButton title="Cancel SOS" variant="dangerOutline" onPress={cancel} />
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.title}>Need relief goods?</Text>
            <Text style={styles.sub}>
              Press the button once. The LGU will know your household needs relief goods.
            </Text>
            {messageBox}
            <View style={styles.sosRing}>
              <Pressable
                onPress={confirmSend}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Send SOS"
                accessibilityHint="Asks you to confirm before sending"
                style={({ pressed }) => [styles.sosBtn, pressed && styles.sosBtnPressed, busy && { opacity: 0.85 }]}
              >
                {busy ? <ActivityIndicator color={colors.white} size="large" /> : (
                  <>
                    <TriangleAlert size={44} color={colors.white} />
                    <Text style={styles.sosText}>SOS</Text>
                    <Text style={styles.sosHint}>Tap to send</Text>
                  </>
                )}
              </Pressable>
            </View>
            <Text style={styles.note}>Send it once. Pressing again won't make it more urgent.</Text>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={asking === 'send'}
        danger
        icon={TriangleAlert}
        title="Send SOS?"
        message={
          message.trim() ? (
            <Text style={confirmText.message}>
              Your barangay and the LGU will see that your household needs relief goods, with your message:{'\n'}
              <Text style={confirmText.bold}>"{message.trim()}"</Text>
            </Text>
          ) : 'Your barangay and the LGU will see that your household needs relief goods.'
        }
        note="Send it once. Pressing again won't make it more urgent."
        confirmLabel="Send SOS"
        onCancel={() => setAsking(null)}
        onConfirm={async () => { await send(); setAsking(null); }}
      />

      <ConfirmDialog
        visible={asking === 'cancel'}
        danger
        icon={CircleX}
        title="Do you still need relief goods?"
        message="Cancelling withdraws your SOS. Your barangay and the LGU will no longer see it."
        cancelLabel="Keep SOS"
        confirmLabel="Cancel SOS"
        onCancel={() => setAsking(null)}
        onConfirm={async () => { await doCancel(); setAsking(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, flexGrow: 1 },
  center: { alignItems: 'center', gap: 14, paddingTop: 24 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  // soft red ring around the button so it reads as the main action of the screen
  sosRing: {
    width: 222, height: 222, borderRadius: 111, backgroundColor: colors.dangerTint, marginVertical: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F6D2CE',
  },
  sosBtn: {
    width: 184, height: 184, borderRadius: 92, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 4, borderColor: '#E06A5E',
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14,
    elevation: 10,
  },
  sosBtnPressed: { transform: [{ scale: 0.96 }], shadowOpacity: 0.2, elevation: 4 },
  sosText: { fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: 1, color: colors.white },
  sosHint: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white, opacity: 0.9 },
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
  chipOn: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  chipTextOn: { color: colors.danger, fontFamily: fonts.semibold },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  input: { minHeight: 76, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlignVertical: 'top' },
  sentMsg: { alignSelf: 'stretch', backgroundColor: colors.dangerTint, borderRadius: 10, padding: 10, gap: 2 },
  sentMsgLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.danger },
  sentMsgText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
});
