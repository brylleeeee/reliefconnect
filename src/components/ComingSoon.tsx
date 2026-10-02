// src/components/ComingSoon.tsx  —  temporary screen for tabs not built yet
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './AppHeader';
import { colors, fonts } from '../constants/theme';

export default function ComingSoon({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />
      <View style={styles.body}>
        <Text style={styles.text}>{title} — coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
});