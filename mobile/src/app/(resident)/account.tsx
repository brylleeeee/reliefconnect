// src/app/(resident)/account.tsx  —  Figma frame: resident-account
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import AppHeader from '../../components/AppHeader';
import { useResident } from '../../context/ResidentContext';
import { logout } from '../../lib/auth';
import { colors, fonts } from '../../constants/theme';

// "Juan Dela Cruz" → "JD"
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// "09171234567" → "+63 917 123 4567"
function formatContact(contact: string) {
  if (!/^09\d{9}$/.test(contact)) return contact;
  return `+63 ${contact.slice(1, 4)} ${contact.slice(4, 7)} ${contact.slice(7)}`;
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionArrow}>→</Text>
    </Pressable>
  );
}

export default function Account() {
  const { household, setHousehold, setUser } = useResident();

  if (!household) return <Redirect href="/" />;

  const memberCount = household.members.length + 1; // family members + head of household
  const approved = household.status === 'approved';

  const comingSoon = (feature: string) => Alert.alert(feature, 'This feature is coming soon.');

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout(); // revokes the token on the server and removes it from the phone
          router.replace('/');
          setHousehold(null);
          setUser(null);
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader barangay={household.barangay} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* profile header */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(household.headName)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{household.headName}</Text>
            <Text style={styles.profileRole}>Head of Household</Text>
          </View>
        </View>

        {/* household information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Household Information</Text>
          <View>
            <InfoRow label="Contact Number" value={formatContact(household.contact)} />
            <View style={styles.divider} />
            <InfoRow
              label="Registered Members"
              value={`${memberCount} ${memberCount === 1 ? 'Member' : 'Members'}`}
            />
            <View style={styles.divider} />
            <InfoRow
              label="QR Status"
              value={approved ? 'Active' : 'Pending Approval'}
              valueStyle={{ color: approved ? colors.primary : colors.blue }}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Reference Number"
              value={household.referenceNumber ?? 'Not yet issued'}
              valueStyle={household.referenceNumber ? styles.refIssued : styles.refPending}
            />
          </View>
        </View>

        {/* settings */}
        <View style={styles.actions}>
          <ActionRow label="Change Password" onPress={() => router.push('/change-password')} />
          <ActionRow label="Notification Preferences" onPress={() => comingSoon('Notification Preferences')} />
        </View>

        {/* log out */}
        <Pressable style={({ pressed }) => [styles.logout, pressed && { opacity: 0.7 }]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20 },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  profileText: { flex: 1, gap: 2 },
  profileName: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  profileRole: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },

  infoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  infoTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5, color: colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  infoValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  refIssued: { fontFamily: fonts.bold, color: colors.blue },
  refPending: { fontFamily: fonts.medium, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  actions: { gap: 10 },
  actionRow: {
    height: 49,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  actionArrow: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },

  logout: {
    height: 48,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.danger },
});