// src/app/(resident)/home.tsx  —  Figma frame: resident-home-tab
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { announcements, Announcement } from '../../data/announcements';
import { colors, fonts } from '../../constants/theme';

function AnnouncementCard({ item }: { item: Announcement }) {
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <View style={styles.author}>
          <Building size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.authorText}>{item.author}</Text>
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

export default function Home() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnnouncementCard item={item} />}
        contentContainerStyle={styles.feed}
        ListHeaderComponent={
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Recent Announcements</Text>
            <Pressable hitSlop={8} onPress={() => { /* TODO: full announcements list */ }}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
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
  viewAll: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },

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
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primary },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  cardBody: { gap: 4 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  postedBy: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
});