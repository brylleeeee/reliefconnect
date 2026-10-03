// src/components/UnreadAnnouncementsModal.tsx — adviser: pop-up for unread announcements on launch
import { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Megaphone, Building } from 'lucide-react-native';
import PrimaryButton from './PrimaryButton';
import { fetchAnnouncements, Announcement } from '../data/announcements';
import { getReadIds, markRead } from '../lib/announcementReads';
import { colors, fonts } from '../constants/theme';

let shownThisSession = false; // show at most once per app launch

export default function UnreadAnnouncementsModal() {
  const [unread, setUnread] = useState<Announcement[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shownThisSession) return;
    (async () => {
      try {
        const [items, read] = await Promise.all([fetchAnnouncements(), getReadIds()]);
        const fresh = items.filter((a) => !read.includes(String(a.id)));
        if (fresh.length) {
          shownThisSession = true;
          setUnread(fresh);
          setVisible(true);
        }
      } catch {
        // offline: just skip the pop-up
      }
    })();
  }, []);

  const close = async (openList: boolean) => {
    setVisible(false);
    await markRead(unread.map((a) => String(a.id)));
    if (openList) router.push('/announcements');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBg}>
            <Megaphone size={26} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.title}>
            {unread.length === 1 ? 'New announcement' : `${unread.length} new announcements`}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={{ gap: 10 }}>
            {unread.slice(0, 3).map((a) => (
              <View key={a.id} style={styles.item}>
                <View style={styles.author}>
                  <Building size={12} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.authorText}>{a.author}</Text>
                  <Text style={styles.time}>· {a.time}</Text>
                </View>
                <Text style={styles.itemTitle}>{a.title}</Text>
                <Text style={styles.itemBody} numberOfLines={2}>{a.body}</Text>
              </View>
            ))}
            {unread.length > 3 ? (
              <Text style={styles.more}>+ {unread.length - 3} more in Announcements</Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton title="View All" onPress={() => close(true)} />
            <PrimaryButton title="Got It" variant="outline" onPress={() => close(false)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,42,47,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, textAlign: 'center' },
  list: { alignSelf: 'stretch' },
  item: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primary },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  itemBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  more: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10 },
});