// src/app/(resident)/sos.tsx  —  "my household needs relief goods", with an optional message about the situation
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TriangleAlert, CircleX, WavesHorizontal, LifeBuoy, UtensilsCrossed, HeartPulse, Baby, House, Check, PencilLine,
  type LucideIcon,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import KeyboardScroll from '../../components/KeyboardScroll';
import PrimaryButton from '../../components/PrimaryButton';
import ConfirmDialog, { confirmText } from '../../components/ConfirmDialog';
import { useResident } from '../../context/ResidentContext';
import { Sos, cancelSos, fetchActiveSos, sendSos } from '../../data/sos';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';
import { showAlert } from '../../lib/appAlert';

// Quick reasons residents can tap instead of typing (Filipino first, as most residents write).
// The text is sent as-is, so the SOS scoring keeps recognising it.
const QUICK: { text: string; Icon: LucideIcon }[] = [
  { text: 'Baha na kami', Icon: WavesHorizontal },
  { text: 'Naipit kami / kailangan ng rescue', Icon: LifeBuoy },
  { text: 'Walang pagkain at tubig', Icon: UtensilsCrossed },
  { text: 'May sakit o sugatan', Icon: HeartPulse },
  { text: 'May matanda, buntis o sanggol', Icon: Baby },
  { text: 'Nasira ang bahay', Icon: House },
];

export default function SosScreen() {
  const { household } = useResident();
  const [active, setActive] = useState<Sos | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]); // tapped reasons, in the order tapped
  const [note, setNote] = useState('');               // anything the resident types
  const [noteOpen, setNoteOpen] = useState(false);
  const [addingDetails, setAddingDetails] = useState(false);
  const message = [...picked, note.trim()].filter(Boolean).join(', ');
  const resetMessage = () => { setPicked([]); setNote(''); setNoteOpen(false); };
  const [asking, setAsking] = useState<'send' | 'cancel' | null>(null); // which confirmation is open

  // Tap a reason to add it, tap it again to remove it
  const toggleQuick = (q: string) =>
    setPicked((p) => (p.includes(q) ? p.filter((x) => x !== q) : [...p, q]));

  useFocusEffect(useCallback(() => {
    fetchActiveSos().then(setActive).catch(() => {}).finally(() => setLoading(false));
  }, []));

  const send = async () => {
    setBusy(true);
    try {
      setActive(await sendSos(message));
      resetMessage();
      setAddingDetails(false);
    } catch (e) {
      showAlert('SOS not sent', errorText(e));
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
      showAlert('Could not cancel', errorText(e));
    }
  };

  // Reason tiles (2 per row) + an optional typed note
  const messageBox = (
    <View style={styles.msgBox}>
      <View style={styles.grid}>
        {QUICK.map(({ text, Icon }) => {
          const on = picked.includes(text);
          return (
            <Pressable
              key={text}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.8 }]}
              onPress={() => toggleQuick(text)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={text}
            >
              {on
                ? <Check size={18} color={colors.danger} strokeWidth={2.5} />
                : <Icon size={18} color={colors.textSecondary} strokeWidth={2} />}
              <Text style={[styles.tileText, on && styles.tileTextOn]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>

      {noteOpen ? (
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="Hal. Baha na hanggang tuhod, may lola kaming hindi makalakad"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={400}
          autoFocus
        />
      ) : (
        <Pressable style={styles.addNote} onPress={() => setNoteOpen(true)} hitSlop={6} accessibilityRole="button">
          <PencilLine size={16} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addNoteText}>Write more details</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household?.barangay ?? ''} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <KeyboardScroll contentContainerStyle={styles.content}>
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
                  <Text style={styles.cardTitle}>What's happening?</Text>
                  {messageBox}
                  <PrimaryButton title={busy ? 'Sending…' : 'Send details'} onPress={send} disabled={busy || !message.trim()} />
                  <PrimaryButton title="Never mind" variant="outline" onPress={() => { setAddingDetails(false); resetMessage(); }} />
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
            <Text style={styles.sub}>Tap SOS once. Your barangay and the LGU will be alerted.</Text>

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
                    <TriangleAlert size={40} color={colors.white} />
                    <Text style={styles.sosText}>SOS</Text>
                    <Text style={styles.sosHint}>Tap to send</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* optional details, in one tidy card under the button */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>What's happening?</Text>
                <Text style={styles.optional}>{picked.length ? `${picked.length} selected` : 'Optional'}</Text>
              </View>
              <Text style={styles.cardHint}>Helps the LGU decide who to help first.</Text>
              {messageBox}
            </View>
          </View>
        )}
      </KeyboardScroll>
      </KeyboardAvoidingView>

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
  center: { alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, textAlign: 'center' },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  // soft red ring around the button so it reads as the main action of the screen
  sosRing: {
    width: 208, height: 208, borderRadius: 104, backgroundColor: colors.dangerTint, marginTop: 16, marginBottom: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F6D2CE',
  },
  sosBtn: {
    width: 172, height: 172, borderRadius: 86, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 4, borderColor: '#E06A5E',
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 14,
    elevation: 10,
  },
  sosBtnPressed: { transform: [{ scale: 0.96 }], shadowOpacity: 0.2, elevation: 4 },
  sosText: { fontFamily: fonts.extrabold, fontSize: 32, letterSpacing: 1, color: colors.white },
  sosHint: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white, opacity: 0.9 },

  card: { alignSelf: 'stretch', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flexShrink: 1, alignSelf: 'flex-start', fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  optional: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  cardHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  sent: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger, borderRadius: 16, padding: 20, gap: 12, alignItems: 'center' },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.danger },
  sentText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  msgBox: { alignSelf: 'stretch', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: {
    width: '48.5%', minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  tileOn: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  tileText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.text },
  tileTextOn: { color: colors.danger, fontFamily: fonts.semibold },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  addNoteText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  input: { minHeight: 76, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlignVertical: 'top' },
  sentMsg: { alignSelf: 'stretch', backgroundColor: colors.dangerTint, borderRadius: 10, padding: 10, gap: 2 },
  sentMsgLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.danger },
  sentMsgText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
});
