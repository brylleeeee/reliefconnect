// src/app/(staff)/verification.tsx  —  after a scan or typed reference: check the household, then release aid
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, CircleX } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useStaff } from '../../context/StaffContext';
import { api, errorText, qtyUnit } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

type CheckResult = {
  household: {
    id: number;
    reference_number: string;
    household_head: string;
    purok: string | null;
    members_count: number;
    priority_level: 'high' | 'medium' | 'low';
    barangay: string;
  };
  can_claim: boolean;
  reason: string | null;
  claimed_at: string | null;
  quantity: number;
  unit: string;
};

const PRIORITY = {
  high: { bg: colors.dangerTint, fg: colors.danger, label: 'High priority' },
  medium: { bg: '#FDF3DC', fg: '#946200', label: 'Medium priority' },
  low: { bg: colors.border, fg: colors.textSecondary, label: 'Low priority' },
};

export default function Verification() {
  const { reference, method } = useLocalSearchParams<{ reference: string; method: 'qr' | 'reference_number' }>();
  const { selected } = useStaff();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);

  useEffect(() => {
    if (!selected) {
      setError('No distribution selected. Go back to the dashboard and choose one.');
      return;
    }
    api<CheckResult>(`/distribution/events/${selected.event_id}/check`, { query: { reference_number: reference } })
      .then(setResult)
      .catch((e) => setError(errorText(e)));
  }, [reference, selected]);

  const release = async () => {
    if (!selected || !result) return;
    setReleasing(true);
    try {
      await api(`/distribution/events/${selected.event_id}/claims`, {
        body: { reference_number: result.household.reference_number, verification_method: method ?? 'qr' },
      });
      setReleased(true);
    } catch (e) {
      // e.g. another staff phone recorded this household a moment earlier
      setError(errorText(e));
    } finally {
      setReleasing(false);
    }
  };

  const next = () => router.replace(method === 'reference_number' ? '/manual-entry' : '/scanner');
  const home = () => router.dismissTo('/dashboard');

  const h = result?.household;
  const p = h ? PRIORITY[h.priority_level] : null;
  const ok = released || (result?.can_claim && !error);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Verify Household" subtitle={selected ? `Brgy. ${selected.barangay}` : undefined} />

      <ScrollView contentContainerStyle={styles.content}>
        {!result && !error && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.muted}>Checking {reference}…</Text>
          </View>
        )}

        {(result || error) && (
          <View style={[styles.banner, { backgroundColor: ok ? colors.successTint : colors.dangerTint }]}>
            {ok ? <CircleCheck size={28} color={colors.success} /> : <CircleX size={28} color={colors.danger} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: ok ? colors.success : colors.danger }]}>
                {released ? 'Aid released' : ok ? 'Eligible to claim' : 'Cannot release aid'}
              </Text>
              <Text style={styles.bannerText}>
                {released
                  ? `${qtyUnit(result?.quantity ?? 1, result?.unit ?? '')} recorded for this household.`
                  : ok
                    ? `Release ${qtyUnit(result?.quantity ?? 1, result?.unit ?? '')} to this household.`
                    : error || result?.reason}
              </Text>
              {!ok && result?.claimed_at && (
                <Text style={styles.bannerText}>
                  Claimed on {new Date(result.claimed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}.
                </Text>
              )}
            </View>
          </View>
        )}

        {h && p && (
          <View style={styles.card}>
            <Text style={styles.label}>HOUSEHOLD HEAD</Text>
            <Text style={styles.name}>{h.household_head}</Text>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: p.bg }]}>
                <Text style={[styles.badgeText, { color: p.fg }]}>{p.label}</Text>
              </View>
            </View>
            <View style={styles.grid}>
              <Info label="Reference No." value={h.reference_number} />
              <Info label="Members" value={String(h.members_count)} />
              <Info label="Barangay" value={h.barangay} />
              <Info label="Purok" value={h.purok ?? '—'} />
            </View>
            <Text style={styles.hint}>Ask for a valid ID and check that the name matches before releasing.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {result?.can_claim && !released && !error ? (
          <PrimaryButton
            title={releasing ? 'Recording…' : `Release ${qtyUnit(result.quantity, result.unit)}`}
            onPress={release}
            disabled={releasing}
          />
        ) : (
          (result || error) && (
            <PrimaryButton title={method === 'reference_number' ? 'Enter Another' : 'Scan Next'} onPress={next} />
          )
        )}
        <PrimaryButton title="Back to Dashboard" variant="outline" onPress={home} />
      </View>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  banner: { flexDirection: 'row', gap: 12, borderRadius: 12, padding: 16, alignItems: 'flex-start' },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 16 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 2 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  label: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  row: { flexDirection: 'row' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 4 },
  info: { width: '50%', gap: 2 },
  value: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
});
