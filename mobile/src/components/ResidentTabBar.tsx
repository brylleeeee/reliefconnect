// src/components/ResidentTabBar.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { House, QrCode, TriangleAlert, User } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

const TABS = {
  home: { label: 'Home', Icon: House },
  qr: { label: 'Our QR', Icon: QrCode },
  account: { label: 'Account', Icon: User },
};

export default function ResidentTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
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

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <tab.Icon size={24} color={color} strokeWidth={2} />
            <Text style={[styles.label, { color, fontFamily: focused ? fonts.bold : fonts.medium }]}>
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