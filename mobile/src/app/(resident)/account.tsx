// src/app/(resident)/account.tsx  —  resident: profile card, household details and settings
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import {
  Phone, Users, QrCode, Hash, MapPin, UserPen, KeyRound, MessageCircleWarning, Bell, LogOut, ChevronRight,
  Copy, Check, BadgeCheck,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useResident } from '../../context/ResidentContext';
import { logout } from '../../lib/auth';
import { fetchUpdateRequest, UpdateStatus } from '../../data/updateRequest';
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

/** Icon tile | small label / value. The divider starts after the icon, like a settings list. */
function DetailRow({ Icon, label, value, valueColor, right, last }: {
  Icon: LucideIcon; label: string; value: string; valueColor?: string; right?: React.ReactNode; last?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.tile}>
        <Icon size={20} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={[styles.rowMain, !last && styles.rowLine]}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} selectable>{value}</Text>
        </View>
        {right}
      </View>
    </View>
  );
}

/** A setting that opens another screen. */
function LinkRow({ Icon, label, hint, hintColor, onPress, last }: {
  Icon: LucideIcon; label: string; hint?: string; hintColor?: string; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
    >
      <View style={styles.tile}>
        <Icon size={20} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={[styles.rowMain, styles.linkMain, !last && styles.rowLine]}>
        <Text style={styles.linkLabel} numberOfLines={1}>{label}</Text>
        {hint ? (
          <View style={[styles.hint, { backgroundColor: `${hintColor}1A` }]}>
            <Text style={[styles.hintText, { color: hintColor }]} numberOfLines={1}>{hint}</Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

// Label beside "Update household info" for the latest request
const UPDATE_HINT: Partial<Record<UpdateStatus, { text: string; color: string }>> = {
  pending: { text: 'In review', color: colors.blue },
  rejected: { text: 'Not approved', color: colors.danger },
};

export default function Account() {
  const { household, setHousehold, setUser } = useResident();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false); // themed "Are you sure?" dialog
  const [copied, setCopied] = useState(false);

  // Status of the latest update request, refreshed whenever the tab is opened
  useFocusEffect(useCallback(() => {
    if (household?.status !== 'approved') return;
    fetchUpdateRequest().then((r) => setUpdateStatus(r?.status ?? null)).catch(() => {});
  }, [household?.status]));

  if (!household) return <Redirect href="/" />;

  const memberCount = household.members.length + 1; // family members + head of household
  const approved = household.status === 'approved';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const copyReference = async () => {
    if (!household.referenceNumber) return;
    await Clipboard.setStringAsync(household.referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const doLogout = async () => {
    await logout(); // revokes the token on the server and removes it from the phone
    setConfirmLogout(false);
    router.replace('/');
    setHousehold(null);
    setUser(null);
  };

  const hint = updateStatus ? UPDATE_HINT[updateStatus] : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You'll need to sign in again to see your QR code and announcements."
        confirmLabel="Log Out"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout}
      />
      <AppHeader barangay={household.barangay} />

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.pageTitle}>Account</Text>
          <Text style={styles.pageSub}>Manage your household account</Text>
        </View>

        {/* Profile card: green banner with the initials overlapping it */}
        <View style={styles.profileCard}>
          <View style={styles.banner}>
            {/* soft shapes so the banner isn't a flat block */}
            <View style={[styles.blob, styles.blobOne]} />
            <View style={[styles.blob, styles.blobTwo]} />
            <View style={[styles.blob, styles.blobThree]} />
          </View>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(household.headName)}</Text>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={2}>{household.headName}</Text>
          <Text style={styles.role}>Head of Household · Brgy. {household.barangay}</Text>
          <View style={[styles.statusPill, !approved && styles.statusPending]}>
            <BadgeCheck size={14} color={approved ? colors.primary : colors.blue} strokeWidth={2.2} />
            <Text style={[styles.statusText, !approved && { color: colors.blue }]}>
              {approved ? 'Verified household' : 'Waiting for approval'}
            </Text>
          </View>
        </View>

        {/* Household details */}
        <Text style={styles.sectionTitle}>Household details</Text>
        <View style={styles.card}>
          <DetailRow Icon={Phone} label="Contact number" value={household.contact ? formatContact(household.contact) : 'Not set'} />
          <DetailRow Icon={MapPin} label="Barangay" value={`${household.barangay}, Urbiztondo`} />
          <DetailRow
            Icon={Users}
            label="Registered members"
            value={`${memberCount} ${memberCount === 1 ? 'member' : 'members'} (including you)`}
          />
          <DetailRow
            Icon={QrCode}
            label="QR status"
            value={approved ? 'Active' : 'Pending approval'}
            valueColor={approved ? colors.primary : colors.blue}
          />
          <DetailRow
            Icon={Hash}
            label="Reference number"
            value={household.referenceNumber ?? 'Not yet issued'}
            valueColor={household.referenceNumber ? colors.text : colors.muted}
            last
            right={household.referenceNumber ? (
              <Pressable
                onPress={copyReference}
                hitSlop={8}
                style={({ pressed }) => [styles.copy, copied && styles.copied, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Copy reference number"
              >
                {copied
                  ? <Check size={14} color={colors.white} strokeWidth={2.6} />
                  : <Copy size={14} color={colors.primary} strokeWidth={2.2} />}
                <Text style={[styles.copyText, copied && { color: colors.white }]}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            ) : null}
          />
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings & help</Text>
        <View style={styles.card}>
          {approved && (
            <LinkRow
              Icon={UserPen}
              label="Update household info"
              hint={hint?.text}
              hintColor={hint?.color}
              onPress={() => router.push('/update-household')}
            />
          )}
          <LinkRow Icon={KeyRound} label="Change password" onPress={() => router.push('/change-password')} />
          <LinkRow Icon={Bell} label="Notification preferences" onPress={() => router.push('/notification-preferences')} />
          <LinkRow Icon={MessageCircleWarning} label="Report a problem" onPress={() => router.push('/report-problem')} last />
        </View>

        {/* Log out */}
        <Pressable
          style={({ pressed }) => [styles.logout, pressed && { backgroundColor: colors.dangerTint }]}
          onPress={() => setConfirmLogout(true)}
          accessibilityRole="button"
        >
          <LogOut size={18} color={colors.danger} strokeWidth={2.2} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.version}>ReliefConnect · Urbiztondo · Version {version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR = 96;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },

  pageTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  pageSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  // Profile card
  profileCard: {
    backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', alignItems: 'center', paddingBottom: 20,
  },
  banner: { alignSelf: 'stretch', height: 96, backgroundColor: colors.pine, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobOne: { width: 220, height: 220, left: -70, top: -130, backgroundColor: colors.forest, opacity: 0.6 },
  blobTwo: { width: 180, height: 180, right: -50, top: -40, backgroundColor: colors.paddy, opacity: 0.35 },
  blobThree: { width: 90, height: 90, right: 90, top: 50, backgroundColor: colors.gold, opacity: 0.18 },
  avatarRing: {
    marginTop: -AVATAR / 2, width: AVATAR + 8, height: AVATAR + 8, borderRadius: (AVATAR + 8) / 2,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: 1, color: colors.white },
  name: {
    marginTop: 12, paddingHorizontal: 20, textAlign: 'center',
    fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: colors.text, textTransform: 'uppercase',
  },
  role: { marginTop: 4, paddingHorizontal: 20, textAlign: 'center', fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  statusPill: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: colors.primaryTint,
  },
  statusPending: { backgroundColor: colors.blueTint },
  statusText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },

  sectionTitle: { marginTop: 6, fontFamily: fonts.bold, fontSize: 16, color: colors.text },

  // Rows
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  rowPressed: { backgroundColor: colors.background },
  tile: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginVertical: 12,
  },
  rowMain: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 14,
    paddingVertical: 14, paddingRight: 14, alignSelf: 'stretch',
  },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  rowValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  linkMain: { paddingVertical: 0 },
  linkLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  hint: { flexShrink: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  hintText: { fontFamily: fonts.bold, fontSize: 11 },

  copy: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: '#BFDAD3', backgroundColor: colors.primaryTint,
  },
  copied: { backgroundColor: colors.primary, borderColor: colors.primary },
  copyText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },

  // Log out
  logout: {
    marginTop: 6, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: '#F2C4BF', backgroundColor: colors.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 16, color: colors.danger },
  version: { textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
