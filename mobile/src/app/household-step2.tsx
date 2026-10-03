// src/app/household-step2.tsx  —  Figma frame: resident-household-step2
import { useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import ScreenHeader from '../components/ScreenHeader';
import ProgressBar from '../components/ProgressBar';
import UploadCard from '../components/UploadCard';
import PrimaryButton from '../components/PrimaryButton';
import { Member } from '../components/MemberCard';
import { useResident } from '../context/ResidentContext';
import { colors, fonts } from '../constants/theme';

type DocKey = 'validId' | 'birthCert';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export default function HouseholdStep2() {
  const { fullName, contact, members } = useLocalSearchParams<{
    fullName: string;
    contact: string;
    members: string;
  }>();
  const { setHousehold } = useResident();

  const [docs, setDocs] = useState<Record<DocKey, ImagePicker.ImagePickerAsset | null>>({
    validId: null,
    birthCert: null,
  });

  const pickFrom = async (key: DocKey, source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return Alert.alert(
        'Permission needed',
        `Please allow ${source === 'camera' ? 'camera' : 'photo'} access to upload your document.`
      );
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_BYTES) {
      return Alert.alert('File too large', 'Please choose an image under 10MB.');
    }

    setDocs((prev) => ({ ...prev, [key]: asset }));
  };

  const chooseSource = (key: DocKey) =>
    Alert.alert('Upload document', 'Choose where to get the photo from.', [
      { text: 'Take Photo', onPress: () => pickFrom(key, 'camera') },
      { text: 'Choose from Gallery', onPress: () => pickFrom(key, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const handleNext = () => {
    if (!docs.validId || !docs.birthCert) {
      return Alert.alert('Missing documents', 'Please upload both your Valid ID and Birth Certificate.');
    }

    // TODO: send fullName, contact, members, and both images to the Laravel API here

    const parsedMembers: Member[] = members ? JSON.parse(members) : [];

    // Saved as PENDING — no QR or reference number until the admin approves
    setHousehold({
      status: 'pending',
      householdName: `${fullName} Household`,
      headName: fullName,
      contact,
      barangay: 'Batancaoa', // TODO: from the API
      members: parsedMembers,
      referenceNumber: null,
      qrToken: null,
    });

    router.dismissAll();
    router.replace({ pathname: '/confirmation', params: { fullName, contact } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Household Profile" subtitle="Step 2 of 3" />
      <ProgressBar step={2} total={3} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Document Verification</Text>
          <Text style={styles.introText}>
            Upload files to verify residency and household status. Clear photo uploads are accepted.
          </Text>
        </View>

        <UploadCard
          title="Valid ID"
          tint={colors.primaryTint}
          iconColor={colors.primary}
          uri={docs.validId?.uri}
          onPress={() => chooseSource('validId')}
        />
        <UploadCard
          title="Birth Certificate"
          tint={colors.blueTint}
          iconColor={colors.blue}
          uri={docs.birthCert?.uri}
          onPress={() => chooseSource('birthCert')}
        />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Next" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 20 },
  intro: { gap: 4 },
  introTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  introText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});