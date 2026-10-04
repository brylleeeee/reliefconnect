// src/app/(staff)/scan-logs.tsx  —  adviser: scanned logs, households served, relief item breakdown
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CircleCheck, CircleX, TriangleAlert, QrCode, Keyboard } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import { useStaff } from '../../context/StaffContext';
import { getScans, ScanEntry, ScanResult } from '../../lib/scanLog';
import { colors, fonts } from '../../constants/theme';

type Filter = 'all' | 'released' | 'blocked';

const RESULT: Record<ScanResult, { label: string; fg: string; bg: string; Icon: typeof CircleCheck }> = {
  released: { label: 'Released', fg: colors.success, bg: colors.successTint, Icon: CircleCheck },
  blocked: { label: 'Not released', fg: colors.danger, bg: colors.dangerTint, Icon: CircleX },
  error: { label: 'Error', fg: '#946200', bg: '#FDF3DC', Icon: TriangleAlert },
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ScanLogs() {
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const { user } = useStaff();
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [filter, setFilter] = useState<Filter>(params.filter ?? 'all');

  useFocusEffect(useCallback(() => {
    getScans().then((all) => setScans(all.filter((s) => !user || s.staffId === user.id)));
  }, [user]));

  const today = scans.filter((s) => isToday(s.at));
  const releasedToday = today.filter((s) => s.result === 'released');

  // relief item breakdown: total released today, per item
  const breakdown = Object.values(
    releasedToday.reduce<Record<string, { item: string; unit: string; quantity: number; households: number }>>(
      (acc, s) => {
        const key = `${s.item}|${s.unit}`;
        acc[key] ??= { item: s.item, unit: s.unit, quantity: 0, households: 0 };
        acc[key].quantity += s.quantity;
        acc[key].households += 1;
        return acc;
      },
      {},
    ),
  );

  const shown = scans.filter((s) =>
    filter === 'all' ? true : filter === 'released' ? s.result === 'released' : s.result !== 'released');

  const chip = (value: Filter, label: string) => (
    <Pressable
      key={value}
      onPress={() => setFilter(value)}
      style={[styles.chip, filter === value && styles.chipActive]}
    >
      <Text style={[styles.chipText, filter === value && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="My Scan Logs" subtitle="Saved on this phone" />

      <FlatList
        data={shown}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={styles.stats}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SERVED TODAY</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{releasedToday.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SCANS TODAY</Text>
                <Text style={[styles.statValue, { color: colors.blue }]}>{today.length}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.statLabel}>RELIEF ITEMS RELEASED TODAY</Text>
              {breakdown.length === 0 ? (
                <Text style={styles.muted}>Nothing released yet today.</Text>
              ) : (
                breakdown.map((b) => (
                  <View key={`${b.item}-${b.unit}`} style={styles.breakRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breakItem}>{b.item}</Text>
                      <Text style={styles.muted}>{b.households} households</Text>
                    </View>
                    <Text style={styles.breakQty}>{b.quantity} {b.unit}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.chips}>
              {chip('all', 'All')}
              {chip('released', 'Released')}
              {chip('blocked', 'Not released')}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.muted, styles.empty]}>No scans to show yet.</Text>}
        renderItem={({ item: s }) => {
          const r = RESULT[s.result];
          return (
            <View style={styles.row}>
              <r.Icon size={22} color={r.fg} strokeWidth={2} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.head}>{s.head ?? s.reference}</Text>
                <Text style={styles.muted}>
                  {s.reference} · Brgy. {s.barangay} · {when(s.at)}
                </Text>
                {s.result === 'released' ? (
                  <Text style={styles.detail}>{s.quantity} {s.unit} of {s.item}</Text>
                ) : s.reason ? (
                  <Text style={[styles.detail, { color: r.fg }]}>{s.reason}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[styles.badge, { backgroundColor: r.bg }]}>
                  <Text style={[styles.badgeText, { color: r.fg }]}>{r.label}</Text>
                </View>
                {s.method === 'qr' ? (
                  <QrCode size={14} color={colors.muted} strokeWidth={2} />
                ) : (
                  <Keyboard size={14} color={colors.muted} strokeWidth={2} />
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 10 },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', paddingVertical: 32 },

  stats: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  breakRow: { flexDirection: 'row', alignItems: 'center' },
  breakItem: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  breakQty: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.primary },

  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  head: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  detail: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10 },
});