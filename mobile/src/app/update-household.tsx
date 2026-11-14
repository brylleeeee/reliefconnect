// src/app/update-household.tsx  —  ask the barangay to update household details or family members
// Panel recommendation after the alpha test. Nothing changes until the barangay approves;
// the reference number and QR code stay the same.
import { useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch,
  ActivityIndicator, TextInput, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, Redirect } from 'expo-router';
import { Plus, Clock3, CircleX, BadgeCheck } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import MemberCard from '../components/MemberCard';
import FormInput from '../components/FormInput';
import PrimaryButton from '../components/PrimaryButton';
import { useResident } from '../context/ResidentContext';
import { Household, Member, draftFrom, memberProblem, newMember } from '../data/household';
import {
  UpdateRequest, cancelUpdateRequest, describeChanges, fetchUpdateRequest, submitUpdateRequest,
} from '../data/updateRequest';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

export default function UpdateHousehold() {
  const { household, refresh } = useResident();
  const [latest, setLatest] = useState<UpdateRequest | null | undefined>(undefined); // undefined = loading
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  // Form, filled from the household as it is on the server right now
  const [purok, setPurok] = useState('');
  const [address, setAddress] = useState('');
  const [soloParent, setSoloParent] = useState(false);
  const [head, setHead] = useState<Member>(newMember('Head'));
  const [members, setMembers] = useState<Member[]>([]);
  const [reason, setReason] = useState('');

  const fillFrom = (h: Household) => {
    const d = draftFrom(h);
    setPurok(d.purok); setAddress(d.address); setSoloParent(d.isSoloParent);
    setHead(d.head); setMembers(d.members); setReason('');
  };

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [h, r] = await Promise.all([refresh(), fetchUpdateRequest()]);
      if (h) fillFrom(h);
      setLatest(r);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [refresh]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!household) return <Redirect href="/" />;
  if (household.status !== 'approved') return <Redirect href="/account" />;

  const updateMember = (id: string, patch: Partial<Member>) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));
  const addMember = () => setMembers((prev) => [...prev, newMember()]);

  const send = async () => {
    if (!purok.trim()) return Alert.alert('Purok needed', 'Enter your purok, e.g. Purok 3.');
    const problem =
      memberProblem(head, 'the household head') ??
      members.map((m, i) => memberProblem(m, `family member #${i + 1}`)).find(Boolean);
    if (problem) return Alert.alert('Check the member details', problem);
    if (!reason.trim()) {
      return Alert.alert('Reason needed', 'Tell your barangay what changed, e.g. "New baby born in October".');
    }

    setBusy(true);
    try {
      const r = await submitUpdateRequest(
        { barangayId: household.barangayId, barangayName: household.barangay, purok, address,
          isSoloParent: soloParent, head: { ...head, relationship: 'Head' }, members },
        reason,
      );
      setLatest(r);
      Alert.alert('Request sent', 'Your barangay will review it. You will get a notification once it is approved.');
    } catch (e) {
      Alert.alert('Could not send the request', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () =>
    Alert.alert('Cancel this request?', 'Your barangay will no longer see it. You can send a new one after.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request', style: 'destructive', onPress: async () => {
          setBusy(true);
          try { await cancelUpdateRequest(); await load(); }
          catch (e) { Alert.alert('Could not cancel', errorText(e)); }
          finally { setBusy(false); }
        },
      },
    ]);

  // ---------- loading / error ----------
  if (latest === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Update Household Info" />
        <View style={styles.center}>
          {loadError
            ? <Pressable onPress={load}><Text style={styles.error}>{loadError} Tap to retry.</Text></Pressable>
            : <ActivityIndicator color={colors.primary} />}
        </View>
      </SafeAreaView>
    );
  }

  // ---------- a request is waiting: show it instead of the form ----------
  if (latest?.status === 'pending') {
    const lines = latest.summary ? describeChanges(latest.summary) : [];
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Update Household Info" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.banner, { backgroundColor: colors.blueTint }]}>
            <View style={styles.bannerHead}>
              <Clock3 size={18} color={colors.blue} strokeWidth={2} />
              <Text style={[styles.bannerTitle, { color: colors.blue }]}>Waiting for barangay review</Text>
            </View>
            <Text style={styles.bannerText}>
              Sent {when(latest.submitted_at)}. Your household stays as it is until the barangay approves.
              They may ask you to show a document, such as a birth certificate.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What you asked to change</Text>
            {lines.map((l) => <Text key={l} style={styles.changeLine}>• {l}</Text>)}
            {latest.reason ? <Text style={styles.reasonText}>Reason: {latest.reason}</Text> : null}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton title={busy ? 'Cancelling…' : 'Cancel Request'} variant="outline" onPress={cancel} disabled={busy} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- the form ----------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Update Household Info" subtitle={`Barangay ${household.barangay}`} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {latest?.status === 'rejected' && (
            <View style={[styles.banner, { backgroundColor: colors.dangerTint }]}>
              <View style={styles.bannerHead}>
                <CircleX size={18} color={colors.danger} strokeWidth={2} />
                <Text style={[styles.bannerTitle, { color: colors.danger }]}>Your last request was not approved</Text>
              </View>
              <Text style={styles.bannerText}>{latest.review_note ?? 'Please check your details.'}</Text>
            </View>
          )}
          {latest?.status === 'approved' && latest.reviewed_at && (
            <View style={[styles.banner, { backgroundColor: colors.successTint }]}>
              <View style={styles.bannerHead}>
                <BadgeCheck size={18} color={colors.success} strokeWidth={2} />
                <Text style={[styles.bannerTitle, { color: colors.success }]}>Last update approved {when(latest.reviewed_at)}</Text>
              </View>
            </View>
          )}

          <Text style={styles.intro}>
            Edit what changed, such as a new baby, a member who moved out, a new purok, or a wrong birthdate.
            Your barangay reviews the request first. Your QR code and reference number stay the same.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <FormInput label="Purok" placeholder="e.g. Purok 3" value={purok} onChangeText={setPurok} />
            <FormInput label="Street / Sitio (optional)" placeholder="e.g. Sitio Centro, near the chapel"
                       value={address} onChangeText={setAddress} />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>I am a solo parent</Text>
              <Switch value={soloParent} onValueChange={setSoloParent}
                      trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white}
                      accessibilityLabel="I am a solo parent" />
            </View>
            <Text style={styles.hint}>Moving to another barangay? Visit your new barangay hall instead.</Text>
          </View>

          <MemberCard member={head} title="Head of Household" isHead
                      onChange={(patch) => setHead((h) => ({ ...h, ...patch }))} />

          {members.map((member, index) => (
            <MemberCard key={member.id} member={member} title={`Family Member #${index + 1}`}
                        onChange={(patch) => updateMember(member.id, patch)}
                        onRemove={() => removeMember(member.id)} />
          ))}

          <Pressable style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]} onPress={addMember}>
            <Plus size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addText}>Add Family Member</Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for the update</Text>
            <TextInput
              style={styles.textArea}
              multiline
              maxLength={500}
              placeholder='e.g. "Our baby was born on Oct 12" or "My birthdate was wrong"'
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              accessibilityLabel="Reason for the update"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title={busy ? 'Sending…' : 'Send Request to Barangay'} onPress={send} disabled={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, textAlign: 'center' },

  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  banner: { borderRadius: 12, padding: 16, gap: 6 },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 13, flex: 1 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, lineHeight: 18 },

  section: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 12,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  changeLine: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, lineHeight: 19 },
  reasonText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  toggleLabel: { flex: 1, paddingRight: 12, fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  textArea: {
    minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
    paddingHorizontal: 16, paddingTop: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text,
    textAlignVertical: 'top',
  },

  addButton: {
    minHeight: 44, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },

  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});
