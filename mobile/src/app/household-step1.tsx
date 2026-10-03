// src/app/household-step1.tsx  —  Figma frame: resident-household-step1
import { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import ProgressBar from '../components/ProgressBar';
import MemberCard from '../components/MemberCard';
import FormInput from '../components/FormInput';
import PrimaryButton from '../components/PrimaryButton';
import { useResident } from '../context/ResidentContext';
import {
  Barangay, HouseholdDraft, Member, draftFrom, fetchBarangays, memberProblem, newMember,
} from '../data/household';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

export default function HouseholdStep1() {
  const { fullName, contact } = useLocalSearchParams<{ fullName?: string; contact?: string }>();
  const { user, household } = useResident();

  // Correcting a rejected application starts from what was sent before
  const previous = household?.status === 'rejected' ? draftFrom(household) : null;
  const headName = fullName ?? user?.name ?? '';
  const phone = contact ?? user?.phone ?? '';

  const [barangays, setBarangays] = useState<Barangay[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [barangay, setBarangay] = useState<Barangay | null>(
    previous ? { id: previous.barangayId, name: previous.barangayName } : null,
  );
  const [purok, setPurok] = useState(previous?.purok ?? '');
  const [address, setAddress] = useState(previous?.address ?? '');
  const [soloParent, setSoloParent] = useState(previous?.isSoloParent ?? false);
  const [head, setHead] = useState<Member>(previous?.head ?? newMember('Head', headName));
  const [members, setMembers] = useState<Member[]>(previous?.members ?? []);

  const loadBarangays = () => {
    setLoadError('');
    fetchBarangays().then(setBarangays).catch((e) => setLoadError(errorText(e)));
  };
  useEffect(loadBarangays, []);

  const updateMember = (id: string, patch: Partial<Member>) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));
  const addMember = () => setMembers((prev) => [...prev, newMember()]);

  const handleNext = () => {
    if (!barangay) return Alert.alert('Barangay needed', 'Select the barangay where your household lives.');
    if (!purok.trim()) return Alert.alert('Purok needed', 'Enter your purok, e.g. Purok 3.');

    const problem =
      memberProblem(head, 'the household head') ??
      members.map((m, i) => memberProblem(m, `family member #${i + 1}`)).find(Boolean);
    if (problem) return Alert.alert('Check the member details', problem);

    const draft: HouseholdDraft = {
      barangayId: barangay.id,
      barangayName: barangay.name,
      purok,
      address,
      isSoloParent: soloParent,
      head: { ...head, relationship: 'Head' },
      members,
    };
    router.push({ pathname: '/household-step2', params: { draft: JSON.stringify(draft) } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Household Profile" subtitle="Step 1 of 3" />
        <ProgressBar step={1} total={3} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {household?.status === 'rejected' && household.rejectionReason && (
            <View style={styles.rejected}>
              <Text style={styles.rejectedTitle}>Your application needs changes</Text>
              <Text style={styles.rejectedText}>{household.rejectionReason}</Text>
            </View>
          )}

          {/* where the household lives */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <Text style={styles.label}>Barangay</Text>
            {barangays === null && !loadError && <ActivityIndicator color={colors.primary} />}
            {loadError ? (
              <Pressable onPress={loadBarangays}>
                <Text style={styles.error}>{loadError} Tap to retry.</Text>
              </Pressable>
            ) : (
              <View style={styles.chips}>
                {barangays?.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => setBarangay(b)}
                    style={[styles.chip, barangay?.id === b.id && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: barangay?.id === b.id }}
                  >
                    <Text style={[styles.chipText, barangay?.id === b.id && styles.chipTextActive]}>{b.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <FormInput label="Purok" placeholder="e.g. Purok 3" value={purok} onChangeText={setPurok} />
            <FormInput
              label="Street / Sitio (optional)"
              placeholder="e.g. Sitio Centro, near the chapel"
              value={address}
              onChangeText={setAddress}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>I am a solo parent</Text>
              <Switch
                value={soloParent}
                onValueChange={setSoloParent}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel="I am a solo parent"
              />
            </View>
          </View>

          <MemberCard
            member={head}
            title={`Head of Household${phone ? ` · ${phone}` : ''}`}
            isHead
            onChange={(patch) => setHead((h) => ({ ...h, ...patch }))}
          />

          {members.map((member, index) => (
            <MemberCard
              key={member.id}
              member={member}
              title={`Family Member #${index + 1}`}
              onChange={(patch) => updateMember(member.id, patch)}
              onRemove={() => removeMember(member.id)}
            />
          ))}

          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
            onPress={addMember}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addText}>Add Family Member</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Next" onPress={handleNext} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 16 },

  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.white, fontFamily: fonts.semibold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  toggleLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },

  rejected: { backgroundColor: colors.dangerTint, borderRadius: 12, padding: 16, gap: 4 },
  rejectedTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.danger },
  rejectedText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, lineHeight: 18 },

  addButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },

  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});
