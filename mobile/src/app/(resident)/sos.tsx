// src/app/(resident)/sos.tsx  —  one button: "my household needs relief goods"
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useResident } from '../../context/ResidentContext';
import { Sos, cancelSos, fetchActiveSos, sendSos } from '../../data/sos';
import { errorText } from '../../lib/api';
import { colors, fonts } from '../../constants/theme';

export default function SosScreen() {
  const { household } = useResident();
  const [active, setActive] = useState<Sos | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchActiveSos().then(setActive).catch(() => {}).finally(() => setLoading(false));
  }, []));

  const send = async () => {
    setBusy(true);
    try {
      setActive(await sendSos());
    } catch (e) {
      Alert.alert('SOS not sent', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // A confirmation first, so a pocket tap can't send an alert
  const confirmSend = () =>
    Alert.alert('Send SOS?', 'Your barangay and the LGU will see that your household needs relief goods.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: send },
    ]);

  const cancel = () =>
    Alert.alert('Do you still need relief goods?', 'Cancelling withdraws your SOS.', [
      { text: 'Keep SOS', style: 'cancel' },
      { text: 'Cancel SOS', onPress: async () => {
        try { await cancelSos(); setActive(null); } catch (e) { Alert.alert('Could not cancel', errorText(e)); }
      } },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household?.barangay ?? ''} />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : active ? (
          <View style={styles.sent}>
            <View style={styles.sentIcon}><TriangleAlert size={28} color={colors.white} /></View>
            <Text style={styles.sentTitle}>SOS sent</Text>
            <Text style={styles.sentText}>
              The LGU can see that your household{household?.barangay ? ` in ${household.barangay}` : ''} needs relief goods.
              Barangays with the most households asking are served first. Please keep your phone on.
            </Text>
            <PrimaryButton title="Cancel SOS" variant="outline" onPress={cancel} />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.title}>Need relief goods?</Text>
            <Text style={styles.sub}>
              Press the button once. The LGU will know your household needs relief goods.
            </Text>
            <Pressable onPress={confirmSend} disabled={busy}
                       style={({ pressed }) => [styles.sosBtn, (pressed || busy) && { opacity: 0.85 }]}>
              {busy ? <ActivityIndicator color={colors.white} size="large" /> : (
                <>
                  <TriangleAlert size={44} color={colors.white} />
                  <Text style={styles.sosText}>SOS</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.note}>Send it once. Pressing again won't make it more urgent.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, flexGrow: 1 },
  center: { alignItems: 'center', gap: 14, paddingTop: 24 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  sosBtn: {
    width: 190, height: 190, borderRadius: 95, backgroundColor: colors.danger, marginVertical: 24,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  sosText: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.white },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  sent: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.danger, borderRadius: 16, padding: 20, gap: 12, alignItems: 'center' },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.danger },
  sentText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
});
