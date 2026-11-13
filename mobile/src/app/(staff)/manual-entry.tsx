// src/app/(staff)/manual-entry.tsx  —  type a household's reference number (when the QR can't be scanned)
// As staff type, matching households from this distribution's list appear below the box (reference number
// or household head's name). The list is the one already on the phone for offline mode, so suggestions are
// instant and also work without internet.
import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  View, Text, KeyboardAvoidingView, Platform, Alert, TextInput, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { useStaff } from '../../context/StaffContext';
import { downloadPack, getPack, OfflinePack, PackHousehold } from '../../lib/offline';
import { colors, fonts } from '../../constants/theme';

const MAX_SUGGESTIONS = 6;
const MIN_CHARS = 2;

const PRIORITY: Record<PackHousehold['priority_level'], { label: string; bg: string; fg: string }> = {
  high: { label: 'High', bg: colors.dangerTint, fg: colors.danger },
  medium: { label: 'Medium', bg: '#FEF6E0', fg: '#9A6B00' },
  low: { label: 'Low', bg: colors.blueTint, fg: colors.blue },
};

export default function ManualEntry() {
  const { selected } = useStaff();
  const [reference, setReference] = useState('');
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Coming back from Verification ("Enter Another"): start with an empty box, ready to type,
  // and load this distribution's household list for suggestions
  useFocusEffect(useCallback(() => {
    setReference('');
    const t = setTimeout(() => inputRef.current?.focus(), 250); // after the back transition

    let active = true;
    (async () => {
      if (!selected) return;
      // The dashboard keeps this list fresh while online; download it here if it isn't on the phone yet
      const saved = await getPack(selected.event_id, selected.barangay_id);
      const list = saved ?? (await downloadPack(selected.event_id, selected.barangay_id).catch(() => null));
      if (active) setPack(list);
    })();

    return () => { active = false; clearTimeout(t); };
  }, [selected?.event_id, selected?.barangay_id]));

  // Matches by reference number or by the household head's name
  const query = reference.trim().toUpperCase();
  const suggestions = useMemo(() => {
    if (!pack || query.length < MIN_CHARS) return [];
    return pack.households
      .filter((h) => h.reference_number.includes(query) || h.household_head.toUpperCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [pack, query]);

  const verify = (value: string) =>
    router.push({ pathname: '/verification', params: { reference: value, method: 'reference_number' } });

  const handleCheck = () => {
    if (!query) return Alert.alert('Reference number needed', 'Type the reference number shown on the resident\'s app or slip.');
    // Typed a name and exactly one household matches: use its reference number
    const exact = pack?.households.find((h) => h.reference_number === query);
    if (!exact && suggestions.length === 1) return verify(suggestions[0].reference_number);
    verify(query);
  };

  const noMatch = !!pack && query.length >= MIN_CHARS && suggestions.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Reference Number" subtitle={selected ? `Brgy. ${selected.barangay}` : undefined} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Use this when the resident has no phone or the QR code can't be scanned. The reference number is on the
            resident's Our QR tab or their printed walk-in slip.
          </Text>

          <FormInput
            ref={inputRef}
            label="Household Reference Number"
            placeholder="e.g. URB-2026-000123"
            value={reference}
            onChangeText={(v) => setReference(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleCheck}
          />
          <Text style={styles.hint}>
            {pack
              ? 'Tip: you can also type the household head\'s name.'
              : 'Suggestions appear once this distribution\'s household list is on the phone (connect to the internet once).'}
          </Text>

          {/* matching households */}
          {suggestions.length > 0 && (
            <View style={styles.list}>
              {suggestions.map((h, i) => {
                const p = PRIORITY[h.priority_level] ?? PRIORITY.low;
                return (
                  <Pressable
                    key={h.reference_number}
                    onPress={() => verify(h.reference_number)}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { backgroundColor: colors.primaryTint }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${h.household_head}, ${h.reference_number}`}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.ref}>{h.reference_number}</Text>
                      <Text style={styles.head} numberOfLines={1}>{h.household_head}</Text>
                      <View style={styles.tags}>
                        <Text style={styles.meta}>
                          {h.purok ? `${h.purok} · ` : ''}{h.members_count} {h.members_count === 1 ? 'member' : 'members'}
                        </Text>
                        <View style={[styles.tag, { backgroundColor: p.bg }]}>
                          <Text style={[styles.tagText, { color: p.fg }]}>{p.label}</Text>
                        </View>
                        {h.claimed_at ? (
                          <View style={[styles.tag, { backgroundColor: colors.border }]}>
                            <Text style={[styles.tagText, { color: colors.textSecondary }]}>Already claimed</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {noMatch && (
            <View style={styles.empty}>
              <Search size={16} color={colors.muted} strokeWidth={2} />
              <Text style={styles.emptyText}>
                No household in this distribution matches "{reference.trim()}". You can still tap Check Household.
              </Text>
            </View>
          )}

          {pack && suggestions.length > 0 && (
            <Text style={styles.updated}>
              List from {new Date(pack.downloaded_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.
              The server checks again when you open a household.
            </Text>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton title="Check Household" onPress={handleCheck} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 12 },
  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginBottom: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },

  list: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  ref: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.3, color: colors.text },
  head: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: fonts.semibold, fontSize: 10 },

  empty: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  emptyText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  updated: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.muted },

  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});
