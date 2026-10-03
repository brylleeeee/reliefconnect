// src/components/ProgressBar.tsx
import { View, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

type Props = { step: number; total: number };

export default function ProgressBar({ step, total }: Props) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { flex: step }]} />
      <View style={{ flex: total - step }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', height: 4, backgroundColor: colors.border, marginTop: 8 },
  fill: { backgroundColor: colors.primary },
});