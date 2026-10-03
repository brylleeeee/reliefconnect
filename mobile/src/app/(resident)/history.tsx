// src/app/(resident)/history.tsx  —  adviser: past claims, tap a date to see the items
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  ChevronDown, ChevronUp, Package, Banknote, MapPin, QrCode, Keyboard, User,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { useResident } from '../../context/ResidentContext';
import { fetchHistory, ClaimRecord } from '../../data/history';
import { colors, fonts } from '../../constants/theme';

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

function ClaimCard({ claim, open, onToggle }: { claim: ClaimRecord; open: boolean; onToggle: () => void }) {
  const isCash = claim.category === 'Cash';
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <View style={[styles.iconBg, { backgroundColor: isCash ? colors.successTint : colors.primaryTint }]}>
          {isCash ? (
            <Banknote size={20} color={colors.success} strokeWidth={2} />
          ) : (
            <Package size={20} color={colors.primary} strokeWidth={2} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{dateLabel(claim.claimedAt)}</Text>
          <Text style={styles.event} numberOfLines={1}>{claim.eventName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{claim.category}</Text>
        </View>
        <Chevron size={20} color={colors.textSecondary} strokeWidth={2} />
      </Pressable>

      {open ? (
        <View style={styles.details}>
          <Text style={styles.detailsTitle}>{isCash ? 'Amount received' : 'Items received'}</Text>
          {isCash ? (
            <Text style={styles.cash}>{peso(claim.cashAmount ?? 0)}</Text>
          ) : (
            claim.items.map((it) => (
              <View key={it.name} style={styles.itemRow}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemQty}>{it.quantity} {it.unit}</Text>
              </View>
            ))
          )}

          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.infoText}>{claim.venue} · {timeLabel(claim.claimedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <User size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.infoText}>Received by {claim.receivedBy}</Text>
          </View>
          <View style={styles.infoRow}>
            {claim.method === 'qr' ? (
              <QrCode size={14} color={colors.textSecondary} strokeWidth={2} />
            ) : (
              <Keyboard size={14} color={colors.textSecondary} strokeWidth={2} />
            )}
            <Text style={styles.infoText}>
              Verified by {claim.method === 'qr' ? 'QR code' : 'reference number'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function History() {
  const { household } = useResident();
  const [claims, setClaims] = useState<ClaimRecord[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setClaims(await fetchHistory());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const list = claims ?? [];
  const totalCash = list.reduce((sum, c) => sum + (c.cashAmount ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household?.barangay} />

      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.feed}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={styles.stats}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AID RECEIVED</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{list.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CASH RECEIVED</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>{peso(totalCash)}</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Claim History</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {claims === null ? 'Loading…' : 'No aid received yet. Distribution schedules appear in Announcements.'}
          </Text>
        }
        renderItem={({ item }) => (
          <ClaimCard
            claim={item}
            open={openId === item.id}
            onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  feed: { padding: 16, gap: 12 },

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
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.5, color: colors.text },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 32 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardOpen: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  date: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  event: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary },

  details: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
    gap: 8,
  },
  detailsTitle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5, color: colors.textSecondary },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  itemQty: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  cash: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.success },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
});