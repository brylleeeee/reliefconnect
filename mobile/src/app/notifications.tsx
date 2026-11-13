// src/app/notifications.tsx  —  resident bell: announcements, schedules, approval, aid received
import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import {
  Megaphone, CalendarClock, PlayCircle, BadgeCheck, CircleX, PackageCheck,
  AlarmClock, Gift, Siren, Truck, ShieldAlert, FilePen, FileX, Flag,
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import Pager from '../components/Pager';
import { usePaged } from '../lib/usePaged';
import { fetchNotifications, markNotificationsRead, AppNotification } from '../data/notifications';
import { useBadges } from '../context/BadgeContext';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

const ICONS = {
  announcement: { Icon: Megaphone, color: colors.blue },
  schedule: { Icon: CalendarClock, color: colors.primary },
  started: { Icon: PlayCircle, color: colors.primary },
  ended: { Icon: Flag, color: colors.primary },
  approved: { Icon: BadgeCheck, color: colors.success },
  rejected: { Icon: CircleX, color: colors.danger },
  released: { Icon: PackageCheck, color: colors.success },
  reminder: { Icon: AlarmClock, color: colors.danger },
  eligible: { Icon: Gift, color: colors.primary },
  sos_received: { Icon: Siren, color: colors.danger },
  sos_served: { Icon: Truck, color: colors.success },
  security: { Icon: ShieldAlert, color: colors.danger },
  update_approved: { Icon: FilePen, color: colors.success },
  update_rejected: { Icon: FileX, color: colors.danger },
  report_resolved: { Icon: BadgeCheck, color: colors.success },
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Notifications() {
  const { refresh: refreshBadges } = useBadges();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<AppNotification>>(null);
  const paged = usePaged(items, 10, null, listRef);

  const load = useCallback(async () => {
    try {
      const res = await fetchNotifications();
      setItems(res.notifications); // unread cards stay highlighted while this screen is open
      setUnread(res.unread);
      setError('');
      // Opening the screen counts as seeing them: mark all read on the server and clear the bell badge
      if (res.unread > 0) {
        markNotificationsRead()
          .then(() => refreshBadges())
          .catch(() => {});
      }
    } catch (e) {
      setError(errorText(e));
    }
  }, [refreshBadges]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Tapping marks it read and opens the related screen
  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      markNotificationsRead([n.id])
        .then((count) => { setUnread(count); refreshBadges(); })
        .catch(() => {});
    }
    router.push(n.link as Href);
  };

  const readAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(await markNotificationsRead().catch(() => unread));
    refreshBadges();
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
            {error || (items === null ? 'Loading…' : 'No notifications yet. You will be notified about distribution schedules, aid for your household, your SOS, and logins to your account.')}
          </Text>
        }
        renderItem={({ item: n }) => {
          const { Icon, color } = ICONS[n.kind] ?? ICONS.announcement;
          return (
            <Pressable
              onPress={() => open(n)}
              style={({ pressed }) => [styles.card, !n.read && styles.cardUnread, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.iconBg, { backgroundColor: colors.background }]}>
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
  iconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
});
