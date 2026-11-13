// src/components/Pager.tsx  —  Previous / Page x of y / Next, under a paged list
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';
import type { PageMeta } from '../lib/usePaged';

export default function Pager({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  if (meta.last <= 1) return null;
  const prev = meta.page > 1;
  const next = meta.page < meta.last;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => prev && onPage(meta.page - 1)}
        disabled={!prev}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: !prev }}
        style={({ pressed }) => [styles.btn, !prev && styles.disabled, pressed && styles.pressed]}
      >
        <ChevronLeft size={16} color={colors.primary} strokeWidth={2.4} />
        <Text style={styles.btnText}>Previous</Text>
      </Pressable>

      <Text style={styles.info} accessibilityLabel={`Page ${meta.page} of ${meta.last}`}>
        Page {meta.page} of {meta.last}
      </Text>

      <Pressable
        onPress={() => next && onPage(meta.page + 1)}
        disabled={!next}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: !next }}
        style={({ pressed }) => [styles.btn, !next && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.btnText}>Next</Text>
        <ChevronRight size={16} color={colors.primary} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.white,
  },
  btnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  disabled: { opacity: 0.35 },
  pressed: { backgroundColor: colors.primaryTint },
  info: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
});
