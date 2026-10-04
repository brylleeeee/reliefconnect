// src/app/notifications.tsx  —  resident bell: announcements, schedules, approval, aid received
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Megaphone, CalendarClock, PlayCircle, BadgeCheck, CircleX, PackageCheck } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { fetchNotifications, markNotificationsRead, AppNotification } from '../data/notifications';
import { errorText } from '../lib/api';
import { colors, fonts } from '../constants/theme';

const ICONS = {
  announcement: { Icon: Megaphone, color: colors.blue },
  schedule: { Icon: CalendarClock, color: colors.primary },
  started: { Icon: PlayCircle, color: colors.primary },
  approved: { Icon: BadgeCheck, color: colors.success },
  rejected: { Icon: CircleX, color: colors.danger },
  released: { Icon: PackageCheck, color: colors.success },
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchNotifications();
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

  // Tapping marks it read and opens the related screen
  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      markNotificationsRead([n.id]).then(setUnread).catch(() => {});
    }
    router.push(n.link as Href);
  };

  const readAll = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(await markNotificationsRead().catch(() => unread));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Notifications" subtitle={unread ? `${unread} unread` : undefined} />

      <FlatList
        data={items ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          unread > 0 ? (
            <Pressable onPress={readAll} hitSlop={8} style={styles.readAll}>
              <Text style={styles.readAllText}>Mark all as read</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error || (items === null ? 'Loading…' : 'No notifications yet. You will be notified about announcements, distribution schedules and aid you receive.')}
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
