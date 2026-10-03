// src/app/(staff)/verification.tsx  —  after a scan or typed reference: check the household, then release aid
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { CircleCheck, CircleX, MapPin, Camera } from 'lucide-react-native';
import ScreenHeader from '../../components/ScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useStaff } from '../../context/StaffContext';
import { api, errorText, qtyUnit } from '../../lib/api';
import { addScan, ScanEntry, ScanResult } from '../../lib/scanLog';
import { colors, fonts } from '../../constants/theme';

type CheckResult = {
  household: {
    id: number;
    reference_number: string;
    household_head: string;
    purok: string | null;
    members_count: number;
    priority_level: 'high' | 'medium' | 'low';
    barangay: string;
  };
  can_claim: boolean;
  reason: string | null;
  claimed_at: string | null;
  quantity: number;
  unit: string;
};

type Proof = Pick<ScanEntry, 'photoUri' | 'latitude' | 'longitude' | 'accuracy' | 'ip'>;
type GeoStatus = 'idle' | 'getting' | 'ok' | 'failed';

const PRIORITY = {
  high: { bg: colors.dangerTint, fg: colors.danger, label: 'High priority' },
  medium: { bg: '#FDF3DC', fg: '#946200', label: 'Medium priority' },
  low: { bg: colors.border, fg: colors.textSecondary, label: 'Low priority' },
};

export default function Verification() {
  const { reference, method } = useLocalSearchParams<{ reference: string; method: 'qr' | 'reference_number' }>();
  const { selected, user } = useStaff();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);

  // proof of distribution (adviser)
  const [photo, setPhoto] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [ip, setIp] = useState<string | null>(null);

  // adviser: keep a log of every scan by this staff member
  const log = (outcome: ScanResult, data: CheckResult | null, reason?: string | null, proof?: Proof) => {
    if (!selected) return;
    addScan({
      staffId: user?.id ?? 0,
      eventId: selected.event_id,
      eventName: selected.name,
      barangay: selected.barangay,
      item: selected.item,
      unit: data?.unit ?? selected.unit,
      quantity: data?.quantity ?? selected.quantity_per_household,
      reference: data?.household.reference_number ?? reference,
      head: data?.household.household_head ?? null,
      result: outcome,
      reason: reason ?? null,
      method: method ?? 'qr',
      ...proof,
    }).catch(() => {});
  };

  useEffect(() => {
    if (!selected) {
      setError('No distribution selected. Go back to the dashboard and choose one.');
      return;
    }
    api<CheckResult>(`/distribution/events/${selected.event_id}/check`, { query: { reference_number: reference } })
      .then((data) => {
        setResult(data);
        if (!data.can_claim) log('blocked', data, data.reason);
      })
      .catch((e) => {
        setError(errorText(e));
        log('error', null, errorText(e));
      });
  }, [reference, selected]);

  // Once the household is eligible, start capturing location and IP in the background
  useEffect(() => {
    if (result?.can_claim && !released) {
      getLocation();
      Network.getIpAddressAsync().then(setIp).catch(() => {});
    }
  }, [result]);

  const getLocation = async () => {
    setGeoStatus('getting');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('denied');
      // try a fresh fix for up to 10 s, then fall back to the last known position
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
      const pos = fresh ?? (await Location.getLastKnownPositionAsync());
      if (!pos) throw new Error('no fix');
      setGeo({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null });
      setGeoStatus('ok');
    } catch {
      setGeoStatus('failed');
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Allow camera access to take a photo of the beneficiary receiving the aid.');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!shot.canceled) setPhoto(shot.assets[0].uri);
  };

  const release = async () => {
    if (!selected || !result) return;
    setReleasing(true);
    try {
      await api(`/distribution/events/${selected.event_id}/claims`, {
        body: { reference_number: result.household.reference_number, verification_method: method ?? 'qr' },
      });
      setReleased(true);
      log('released', result, null, {
        photoUri: photo,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        accuracy: geo?.accuracy ?? null,
        ip,
      });
    } catch (e) {
      // e.g. another staff phone recorded this household a moment earlier
      setError(errorText(e));
      log('blocked', result, errorText(e));
    } finally {
      setReleasing(false);
    }
  };

  // adviser: explicit confirmation before finalizing a release
  const confirmRelease = () => {
    if (!result) return;
    if (!photo) {
      Alert.alert('Photo required', 'Take a photo of the beneficiary receiving the aid before releasing.');
      return;
    }
    Alert.alert(
      'Confirm release',
      `Release ${qtyUnit(result.quantity, result.unit)} to ${result.household.household_head}?\n\n` +
        'Make sure the physical relief items were checked and handed over.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm Release', onPress: release }],
    );
  };

  const next = () => router.replace(method === 'reference_number' ? '/manual-entry' : '/scanner');
  const home = () => router.dismissTo('/dashboard');

  const h = result?.household;
  const p = h ? PRIORITY[h.priority_level] : null;
  const ok = released || (result?.can_claim && !error);
  const canRelease = !!result?.can_claim && !released && !error;

  const geoText = {
    idle: 'Location not captured yet',
    getting: 'Getting location…',
    ok: geo ? `${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}${geo.accuracy ? ` (±${Math.round(geo.accuracy)} m)` : ''}` : '',
    failed: 'Location unavailable. You can still release; the time is recorded.',
  }[geoStatus];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Verify Household" subtitle={selected ? `Brgy. ${selected.barangay}` : undefined} />

      <ScrollView contentContainerStyle={styles.content}>
        {!result && !error && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.muted}>Checking {reference}…</Text>
          </View>
        )}

        {(result || error) && (
          <View style={[styles.banner, { backgroundColor: ok ? colors.successTint : colors.dangerTint }]}>
            {ok ? <CircleCheck size={28} color={colors.success} /> : <CircleX size={28} color={colors.danger} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: ok ? colors.success : colors.danger }]}>
                {released ? 'Aid released' : ok ? 'Eligible to claim' : 'Cannot release aid'}
              </Text>
              <Text style={styles.bannerText}>
                {released
                  ? `${qtyUnit(result?.quantity ?? 1, result?.unit ?? '')} recorded for this household.`
                  : ok
                    ? `Release ${qtyUnit(result?.quantity ?? 1, result?.unit ?? '')} to this household.`
                    : error || result?.reason}
              </Text>
              {!ok && result?.claimed_at && (
                <Text style={styles.bannerText}>
                  Claimed on {new Date(result.claimed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}.
                </Text>
              )}
            </View>
          </View>
        )}

        {h && p && (
          <View style={styles.card}>
            <Text style={styles.label}>HOUSEHOLD HEAD</Text>
            <Text style={styles.name}>{h.household_head}</Text>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: p.bg }]}>
                <Text style={[styles.badgeText, { color: p.fg }]}>{p.label}</Text>
              </View>
            </View>
            <View style={styles.grid}>
              <Info label="Reference No." value={h.reference_number} />
              <Info label="Members" value={String(h.members_count)} />
              <Info label="Barangay" value={h.barangay} />
              <Info label="Purok" value={h.purok ?? '—'} />
            </View>
            <Text style={styles.hint}>Ask for a valid ID and check that the name matches before releasing.</Text>
          </View>
        )}

        {/* proof of distribution */}
        {(canRelease || (released && photo)) && (
          <View style={styles.card}>
            <Text style={styles.label}>PROOF OF DISTRIBUTION</Text>

            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoEmpty}>
                <Camera size={28} color={colors.muted} strokeWidth={2} />
                <Text style={styles.muted}>Photo of the beneficiary receiving the aid (required)</Text>
              </View>
            )}

            {!released && (
              <PrimaryButton
                title={photo ? 'Retake Photo' : 'Take Photo'}
                variant={photo ? 'outline' : 'solid'}
                onPress={takePhoto}
              />
            )}

            <View style={styles.geoRow}>
              <MapPin size={14} color={geoStatus === 'failed' ? colors.danger : colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.geoText, geoStatus === 'failed' && { color: colors.danger }]}>{geoText}</Text>
              {geoStatus === 'failed' && !released && (
                <Pressable onPress={getLocation} hitSlop={8}>
                  <Text style={styles.retry}>Retry</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.hint}>
              Time{ip ? `, device IP (${ip})` : ''} and location are recorded automatically.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {canRelease ? (
          <PrimaryButton
            title={releasing ? 'Recording…' : photo ? `Release ${qtyUnit(result!.quantity, result!.unit)}` : 'Take a photo to release'}
            onPress={confirmRelease}
            disabled={releasing || !photo}
          />
        ) : (
          (result || error) && (
            <PrimaryButton title={method === 'reference_number' ? 'Enter Another' : 'Scan Next'} onPress={next} />
          )
        )}
        <PrimaryButton title="Back to Dashboard" variant="outline" onPress={home} />
      </View>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  banner: { flexDirection: 'row', gap: 12, borderRadius: 12, padding: 16, alignItems: 'flex-start' },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 16 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 2 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  label: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  row: { flexDirection: 'row' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 4 },
  info: { width: '50%', gap: 2 },
  value: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  photo: { width: '100%', height: 220, borderRadius: 10, backgroundColor: colors.background },
  photoEmpty: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  geoText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  retry: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },

  footer: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
});