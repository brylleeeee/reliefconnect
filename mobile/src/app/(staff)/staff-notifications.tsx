// src/app/(staff)/staff-notifications.tsx  —  staff bell: distributions scheduled and opened
import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { BadgeCheck, Bell, CalendarClock, PlayCircle } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import Pager from '../../components/Pager';
import { usePaged } from '../../lib/usePaged';
import {
  fetchStaffNotifications, markStaffNotificationsRead, StaffNotification,
} from '../../data/staffNotifications';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

const ICONS = {
  schedule: { Icon: CalendarClock, color: colors.blue },
started: { Icon: PlayCircle, color: colors.primary },
  report_resolved: { Icon: BadgeCheck, color: colors.success },
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function StaffNotifications() {
  const [items, setItems] = useState<StaffNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef<FlatList<StaffNotification>>(null);
  const paged = usePaged(items, 10, null, listRef);

  const load = useCallback(async () => {
    try {
      const res = await fetchStaffNotifications();
      setItems(res.notifications);
      setUnread(res.unread);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Tapping marks it read; dashboard links go back instead of opening a second dashboard
  const open = (n: StaffNotification) => {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      markStaffNotificationsRead([n.id]).then(setUnread).catch(() => {});
    }
    if (!n.link || n.link === '/dashboard') {
      router.back();
    } else {
      router.push(n.link as Href);
    }
  };

  const readAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(await markStaffNotificationsRead().catch(() => unread));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Notifications" subtitle={unread ? `${unread} unread` : undefined} />

      <FlatList
        ref={listRef}
        data={paged.rows}
        ListFooterComponent={<Pager meta={paged.meta} onPage={paged.goTo} />}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          unread > 0 ? (
            <Pressable onPress={readAll} hitSlop={8} style={styles.readAll}>
              <Text style={styles.readAllText}>Mark all as read</Text>
            </Pressable>
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error || (items === null
              ? 'Loading…'
              : 'No notifications yet. You will be notified when your barangay schedules a distribution or opens claiming.')}
          </Text>
        }
        renderItem={({ item: n }) => {
          const { Icon, color } = ICONS[n.kind] ?? { Icon: Bell, color: colors.textSecondary };
          return (
            <Pressable
              onPress={() => open(n)}
              style={({ pressed }) => [styles.card, !n.read && styles.cardUnread, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.iconBg}>
                <Icon size={20} color={color} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, !n.read && { fontFamily: fonts.bold }]} numberOfLines={1}>{n.title}</Text>
                  {!n.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.time}>{when(n.created_at)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 10 },
  readAll: { alignSelf: 'flex-end', marginBottom: 2 },
  readAllText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 32, lineHeight: 19 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
});