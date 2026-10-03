// src/app/(resident)/qr.tsx
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect } from 'expo-router';
import AppHeader from '../../components/AppHeader';
import QrPending from '../../components/QrPending';
import QrApproved from '../../components/QrApproved';
import PrimaryButton from '../../components/PrimaryButton';
import { useResident } from '../../context/ResidentContext';
import { colors, fonts } from '../../constants/theme';

export default function Qr() {
  const { household, refresh } = useResident();
  const [refreshing, setRefreshing] = useState(false);

  // Check for a new status (approval or rejection) every time the tab is opened
  useFocusEffect(useCallback(() => { refresh().catch(() => {}); }, [refresh]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  // not logged in → back to start
  if (!household) return <Redirect href="/" />;

  // The QR only shows once the barangay has approved AND issued it
  const issued = household.status === 'approved' && !!household.qrToken && !!household.referenceNumber;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household.barangay} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {household.status === 'rejected' ? (
          <View style={styles.rejected}>
            <Text style={styles.rejectedTitle}>Application not approved</Text>
            <Text style={styles.rejectedText}>
              Barangay {household.barangay} reviewed your application and asked for changes:
            </Text>
            <Text style={styles.reason}>{household.rejectionReason ?? 'No reason given.'}</Text>
            <PrimaryButton title="Update and Resubmit" onPress={() => router.push('/household-step1')} />
          </View>
        ) : issued ? (
          <QrApproved household={household} />
        ) : (
          <QrPending household={household} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  rejected: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  rejectedTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.danger },
  rejectedText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  reason: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.dangerTint,
    borderRadius: 10,
    padding: 12,
  },
});
