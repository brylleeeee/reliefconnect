// src/app/household-step2.tsx  —  registration step 2: a photo of one valid ID (no birth certificate needed)
import { useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { IdCard, Camera, RefreshCw, CircleCheck, Lightbulb, Sun, ScanLine, ShieldCheck } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import ProgressBar from '../components/ProgressBar';
import PrimaryButton from '../components/PrimaryButton';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import { useResident } from '../context/ResidentContext';
import { HouseholdDraft, submitHousehold } from '../data/household';
import { errorText } from '../lib/api';
import { showAlert } from '../lib/appAlert';
import { colors, fonts } from '../constants/theme';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Common government IDs, as examples (any valid ID with the person's photo and name works)
const ID_EXAMPLES = ['PhilSys National ID', "Driver's License", "Voter's ID", 'UMID', 'Postal ID', 'Senior Citizen ID', 'PWD ID', 'Barangay ID'];

const TIPS = [
  { Icon: Sun, text: 'Good light, no glare or shadow' },
  { Icon: ScanLine, text: 'Whole ID in the frame, name and photo readable' },
  { Icon: ShieldCheck, text: 'Only your barangay sees it, to confirm who you are' },
];

export default function HouseholdStep2() {
  const { draft } = useLocalSearchParams<{ draft: string }>();
  const { setHousehold } = useResident();
  const [sending, setSending] = useState(false);
  const [validId, setValidId] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pickFrom = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return showAlert(
        'Permission needed',
        `Please allow ${source === 'camera' ? 'camera' : 'photo'} access so you can add your valid ID.`,
      );
    }

    // quality 0.5 keeps the ID readable while making the upload much smaller
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      return showAlert('Photo too large', 'Please choose a photo under 10MB.');
    }
    setValidId(asset);
  };

  const handleSubmit = async () => {
    if (!validId) {
      return showAlert('Valid ID needed', 'Add a clear photo of one valid ID so your barangay can confirm who you are.');
    }
    if (!draft) return showAlert('Something went wrong', 'Please go back to step 1 and try again.');

    setSending(true);
    try {
      // Sent as PENDING: the barangay reviews it in QR Issuance Review, then issues the QR
      const household = await submitHousehold(JSON.parse(draft) as HouseholdDraft, { validId });
      setHousehold(household);
      router.dismissAll();
      router.replace('/confirmation');
    } catch (e) {
      showAlert('Could not submit', errorText(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Household Profile" subtitle="Step 2 of 3" />
      <ProgressBar step={2} total={3} />

      <PhotoSourceSheet
        visible={sheetOpen}
        title={validId ? 'Change your valid ID photo' : 'Add your valid ID'}
        subtitle="Take a new photo or pick one you already have."
        onClose={() => setSheetOpen(false)}
        onPick={pickFrom}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Upload a valid ID</Text>
          <Text style={styles.introText}>
            One photo of the household head's valid ID is all you need. No birth certificate required.
          </Text>
        </View>

        {/* The ID: a big tap target when empty, a preview once added */}
        {validId ? (
          <View style={styles.previewCard}>
            <View>
              <Image source={{ uri: validId.uri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.readyBadge}>
                <CircleCheck size={14} color={colors.white} strokeWidth={2.6} />
                <Text style={styles.readyText}>Ready to send</Text>
              </View>
            </View>
            <View style={styles.previewFooter}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.previewTitle}>Valid ID</Text>
                <Text style={styles.previewHint}>Check that your name and photo are readable.</Text>
              </View>
              <Pressable
                onPress={() => setSheetOpen(true)}
                style={({ pressed }) => [styles.changeBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Change the valid ID photo"
              >
                <RefreshCw size={14} color={colors.primary} strokeWidth={2.4} />
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.drop, pressed && styles.dropPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a photo of your valid ID"
          >
            <View style={styles.dropIcon}>
              <IdCard size={34} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.dropTitle}>Tap to add your valid ID</Text>
            <Text style={styles.dropHint}>Take a photo or choose from gallery · up to 10MB</Text>
            <View style={styles.dropBtn}>
              <Camera size={16} color={colors.white} strokeWidth={2.2} />
              <Text style={styles.dropBtnText}>Add photo</Text>
            </View>
          </Pressable>
        )}

        {/* Which IDs work */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accepted IDs</Text>
          <Text style={styles.cardSub}>Any government-issued ID with your photo and name, for example:</Text>
          <View style={styles.chips}>
            {ID_EXAMPLES.map((id) => (
              <View key={id} style={styles.chip}>
                <Text style={styles.chipText}>{id}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How to take a clear photo */}
        <View style={styles.tips}>
          <View style={styles.tipsHead}>
            <Lightbulb size={16} color="#9A6B00" strokeWidth={2.2} />
            <Text style={styles.tipsTitle}>For a clear photo</Text>
          </View>
          {TIPS.map(({ Icon, text }) => (
            <View key={text} style={styles.tip}>
              <Icon size={16} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.tipText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title={sending ? 'Submitting…' : 'Submit Application'} onPress={handleSubmit} disabled={sending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 16 },
  intro: { gap: 4 },
  introTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  introText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },

  // Empty state
  drop: {
    alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 20,
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#A9CFC5', backgroundColor: colors.white,
  },
  dropPressed: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  dropIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  dropTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  dropHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  dropBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 42,
    borderRadius: 999, backgroundColor: colors.primary,
  },
  dropBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },

  // Preview
  previewCard: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  preview: { width: '100%', aspectRatio: 1.58, backgroundColor: colors.background }, // ID card shape
  readyBadge: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.primary,
  },
  readyText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  previewTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  previewHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  changeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },

  // Accepted IDs
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  cardSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },

  // Tips
  tips: { backgroundColor: '#FDF8EA', borderRadius: 16, padding: 16, gap: 10 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipsTitle: { fontFamily: fonts.bold, fontSize: 14, color: '#8A6A12' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },

  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
});
