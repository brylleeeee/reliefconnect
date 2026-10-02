// src/components/AppHeader.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Handshake } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = { barangay?: string };

export default function AppHeader({ barangay = 'Batancaoa' }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.miniLogo}>
          <Handshake size={16} color={colors.white} strokeWidth={2} />
        </View>
        <Text style={styles.brandText}>ReliefConnect</Text>
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>Brgy. {barangay}</Text>
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
});