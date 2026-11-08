// src/components/ResidentTabBar.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { router, type Href, type Tabs } from 'expo-router';

// Expo Router bundles React Navigation, so take the tab bar's props type from <Tabs>
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
import { House, History, Megaphone, TriangleAlert, User } from 'lucide-react-native';
import { useBadges } from '../context/BadgeContext';
import { colors, fonts } from '../constants/theme';

// Adviser's 4 tabs: Home (QR on launch), History, Announcements, Account
const TABS = {
  home: { label: 'Home', Icon: House },
  history: { label: 'History', Icon: History },
  announcements: { label: 'Announcements', Icon: Megaphone },
  account: { label: 'Account', Icon: User },
};

export default function ResidentTabBar({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { announcements } = useBadges(); // unread announcements, kept up to date by BadgeProvider

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;

        const onPress = () => {
          if (focused) return;
          router.navigate(`/(resident)/${route.name}` as Href);
        };

        // Special red SOS button (only appears if an sos.tsx screen exists)
        if (route.name === 'sos') {
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab}>
              <View style={styles.sosCircle}>
                <TriangleAlert size={20} color={colors.white} strokeWidth={2} />
              </View>
              <Text style={[styles.label, styles.sosLabel]}>SOS</Text>
            </Pressable>
          );
        }

        const tab = TABS[route.name as keyof typeof TABS];
        if (!tab) return null;
        const color = focused ? colors.primary : colors.textSecondary;
        const count = route.name === 'announcements' ? announcements : 0;

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <View>
              <tab.Icon size={24} color={color} strokeWidth={2} />
              {count > 0 && (
                <View style={styles.dot}>
                  <Text style={styles.dotText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.medium }]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 10 },
  dot: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontFamily: fonts.bold, fontSize: 9, color: colors.white },
  sosCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  sosLabel: { fontFamily: fonts.bold, color: colors.danger },
});
