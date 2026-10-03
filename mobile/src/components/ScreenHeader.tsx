// src/components/ScreenHeader.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export default function ScreenHeader({ title, subtitle, onBack }: Props) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.side} onPress={onBack ?? (() => router.back())} hitSlop={8}>
        <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
      </Pressable>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {/* empty box on the right keeps the title perfectly centered */}
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  side: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textBlock: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.5, color: colors.textSecondary },
});