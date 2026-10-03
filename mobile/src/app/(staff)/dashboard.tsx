// src/app/(staff)/dashboard.tsx  —  Figma frame: staff-dashboard
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Bell, QrCode, Keyboard, ChevronRight } from 'lucide-react-native';
import { staff } from '../../data/staff';
import { colors, fonts } from '../../constants/theme';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Dashboard() {
  const [online, setOnline] = useState(true);

  // watch the phone's internet connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => router.replace('/') },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* header */}
      <View style={styles.header}>
        <Pressable style={styles.profile} onPress={handleLogout}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(staff.name)}</Text>
          </View>
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Kumusta, Staff {staff.firstName}!</Text>
            <Text style={styles.welcomeSub}>Brgy. {staff.barangay} • Staff</Text>
          </View>
        </Pressable>

        <Pressable style={styles.bell} hitSlop={6} onPress={() => { /* TODO: notifications */ }}>
          <Bell size={18} color={colors.text} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY'S DISTRIBUTED</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{staff.distributedToday} packs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>REMAINING TODAY</Text>
            <Text style={[styles.statValue, { color: colors.blue }]}>{staff.remainingToday} homes</Text>
          </View>
        </View>

        {/* scan QR card */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, styles.scanCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/scanner')}
        >
          <View style={[styles.iconBg, { backgroundColor: 'rgba(255,255,255,0.13)' }]}>
            <QrCode size={24} color={colors.white} strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.white }]}>Scan Beneficiary QR</Text>
            <Text style={[styles.cardSub, { color: '#E8F1F5', opacity: 0.9 }]}>Fastest method using phone camera</Text>
          </View>
          <ChevronRight size={20} color={colors.white} strokeWidth={2} />
        </Pressable>

        {/* manual reference card */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, styles.manualCard, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/manual-entry')}
        >
          <View style={[styles.iconBg, { backgroundColor: colors.blueTint }]}>
            <Keyboard size={24} color={colors.blue} strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Reference Number</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Type household reference manually</Text>
          </View>
          <ChevronRight size={20} color={colors.text} strokeWidth={2} />
        </Pressable>
      </ScrollView>

      {/* connection status */}
      <View
        style={[
          styles.statusPill,
          online
            ? { backgroundColor: colors.successTint, borderColor: colors.success }
            : { backgroundColor: colors.dangerTint, borderColor: colors.danger },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: online ? colors.success : colors.danger }]} />
        <Text style={[styles.statusText, { color: online ? colors.success : colors.danger }]}>
          {online ? 'Online — Live Sync Enabled' : 'Offline — Saving Locally'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    height: 68,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  welcome: { gap: 2 },
  welcomeTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  welcomeSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  bell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: 20, paddingTop: 16, gap: 16 },

  stats: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22 },

  actionCard: {
    height: 88,
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scanCard: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  manualCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  iconBg: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18 },
  cardSub: { fontFamily: fonts.regular, fontSize: 12 },

  statusPill: {
    height: 39,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.semibold, fontSize: 12 },
});