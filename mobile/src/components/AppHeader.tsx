// src/components/AppHeader.tsx
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Handshake, Bell } from 'lucide-react-native';
import { fetchUnreadCount } from '../data/notifications';
import { colors, fonts } from '../constants/theme';

type Props = { barangay?: string };

export default function AppHeader({ barangay }: Props) {
  // Bell with unread badge; refreshed whenever a resident screen opens.
  // Hidden if the count can't be loaded (e.g. not a resident account).
  const [unread, setUnread] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount().then(setUnread).catch(() => setUnread(null));
    }, []),
  );

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.miniLogo}>
          <Handshake size={16} color={colors.white} strokeWidth={2} />
        </View>
        <Text style={styles.brandText}>ReliefConnect</Text>
      </View>

      <View style={styles.right}>
        {barangay ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Brgy. {barangay}</Text>
          </View>
        ) : null}
        {unread !== null && (
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            style={styles.bell}
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <Bell size={18} color={colors.text} strokeWidth={2} />
            {unread > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  badge: { backgroundColor: colors.primaryTint, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  dotText: { fontFamily: fonts.bold, fontSize: 9, color: colors.white },
});