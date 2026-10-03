// src/app/(resident)/announcements.tsx  —  adviser: announcements tab (opening it marks them read)
import { useCallback, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { fetchAnnouncements, Announcement } from '../../data/announcements';
import { getReadIds, markRead } from '../../lib/announcementReads';
import { useResident } from '../../context/ResidentContext';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

function AnnouncementCard({ item, isNew }: { item: Announcement; isNew: boolean }) {
  return (
    <View style={[styles.card, isNew && styles.cardNew]}>
      <View style={styles.meta}>
        <View style={styles.author}>
          <Building size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.authorText}>{item.author}</Text>
          {isNew ? (
            <View style={styles.newPill}>
              <Text style={styles.newText}>NEW</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.time}>{item.time}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardText}>{item.body}</Text>
      </View>

      <Text style={styles.postedBy}>{item.postedBy}</Text>
    </View>
  );
}

export default function Announcements() {
  const { household } = useResident();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, read] = await Promise.all([fetchAnnouncements(), getReadIds()]);
      setItems(list);
      setError('');
      // highlight the unread ones this time, then remember them as read
      const unread = list.map((a) => String(a.id)).filter((id) => !read.includes(id));
      setNewIds(unread);
      if (unread.length) markRead(unread);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

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
        data={items ?? []}
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
            <Text style={styles.viewAll}>Pull down to refresh</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  feed: { padding: 16, gap: 16 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.5, color: colors.text },
  viewAll: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 32 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardNew: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primary },
  newPill: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4 },
  newText: { fontFamily: fonts.bold, fontSize: 9, color: colors.white },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  cardBody: { gap: 4 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  postedBy: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
});