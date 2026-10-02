// src/app/(resident)/qr.tsx
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import AppHeader from '../../components/AppHeader';
import QrPending from '../../components/QrPending';
import QrApproved from '../../components/QrApproved';
import { useResident } from '../../context/ResidentContext';
import { colors } from '../../constants/theme';

export default function Qr() {
  const { household } = useResident();

  // not logged in → back to start
  if (!household) return <Redirect href="/" />;

  // The QR only shows once the admin has approved AND issued it
  const issued = household.status === 'approved' && !!household.qrToken && !!household.referenceNumber;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household.barangay} />
      <ScrollView contentContainerStyle={styles.content}>
        {issued ? <QrApproved household={household} /> : <QrPending household={household} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
});