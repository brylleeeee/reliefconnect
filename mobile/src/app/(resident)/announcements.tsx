// src/app/(resident)/announcements.tsx  —  adviser: announcements tab (opening it marks them read)
import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, Landmark, ChevronRight } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import Pager from '../../components/Pager';
import { usePaged } from '../../lib/usePaged';
import { fetchAnnouncements, distributionStatus, Announcement, Tone } from '../../data/announcements';
import { getReadIds, markRead } from '../../lib/announcementReads';
import { useResident } from '../../context/ResidentContext';
import { useBadges } from '../../context/BadgeContext';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

const CHIP: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: colors.primary, bg: colors.primaryTint },
  blue: { fg: colors.blue, bg: colors.blueTint },
  amber: { fg: '#9A6B00', bg: '#FDF6E3' },
  gray: { fg: colors.textSecondary, bg: '#F1F4F5' },
};

// Short card like a news feed: who, when, the title and one line of the message. Tap to read it all.
function AnnouncementCard({ item, isNew }: { item: Announcement; isNew: boolean }) {
  const fromLgu = item.author.startsWith('LGU');
  const Icon = fromLgu ? Landmark : Building2;
  const status = item.distribution ? distributionStatus(item.distribution) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/announcement/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.card, isNew && styles.cardNew, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${isNew ? 'New. ' : ''}${item.title}, from ${item.author}, ${item.time}. Opens the full announcement.`}
    >
      <View style={[styles.avatar, fromLgu && styles.avatarLgu]}>
        <Icon size={18} color={fromLgu ? colors.blue : colors.primary} strokeWidth={2} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.meta}>
          <Text style={styles.authorText} numberOfLines={1}>{item.author}</Text>
          <Text style={styles.time}>· {item.time}</Text>
          {isNew ? <View style={styles.newDot} /> : null}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardText} numberOfLines={1}>{item.body}</Text>
        {status ? (
          <View style={[styles.statusChip, { backgroundColor: CHIP[status.tone].bg }]}>
            <Text style={[styles.statusText, { color: CHIP[status.tone].fg }]} numberOfLines={1}>
              {status.label} · {status.detail}
            </Text>
          </View>
        ) : null}
      </View>

      <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}

export default function Announcements() {
  const { household } = useResident();
  const { refresh: refreshBadges } = useBadges();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<Announcement>>(null);
  const paged = usePaged(items, 10, null, listRef);

  const load = useCallback(async () => {
    try {
      const [list, read] = await Promise.all([fetchAnnouncements(), getReadIds()]);
      setItems(list);
      setError('');
      // highlight the unread ones this time, then remember them as read
      const unread = list.map((a) => String(a.id)).filter((id) => !read.includes(id));
      setNewIds(unread);
      if (unread.length) {
        await markRead(unread);
        refreshBadges(); // clear the Announcements badge
      }
    } catch (e) {
      setError(errorText(e));
    }
  }, [refreshBadges]);

  // Reload whenever the tab is opened, so new advisories show up
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household?.barangay} />

      <FlatList
        ref={listRef}
        data={paged.rows}
        ListFooterComponent={<Pager meta={paged.meta} onPage={paged.goTo} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error || (items === null ? 'Loading announcements…' : 'No announcements from your barangay yet.')}
          </Text>
        }
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <AnnouncementCard item={item} isNew={newIds.includes(String(item.id))} />}
        contentContainerStyle={styles.feed}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            <Text style={styles.viewAll}>Tap one to read it</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  feed: { padding: 16, gap: 10 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.5, color: colors.text },
  viewAll: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 32 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cardNew: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  cardPressed: { opacity: 0.85 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarLgu: { backgroundColor: colors.blueTint },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  time: { flexShrink: 0, fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  cardText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  statusChip: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontFamily: fonts.bold, fontSize: 11 },
});
