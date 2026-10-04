// src/app/(staff)/scanner.tsx  —  Figma frame: staff-qr-scanner
import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { ArrowLeft, Scan, Flashlight, FlashlightOff, TriangleAlert } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import { colors, fonts } from '../../constants/theme';

const GLASS = 'rgba(255,255,255,0.13)';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const scannedRef = useRef(false); // stops one QR from being read many times

  // when coming back to this screen, allow scanning again
  useFocusEffect(
    useCallback(() => {
      scannedRef.current = false;
    }, [])
  );

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setTorchOn(false);
    // Until the dynamic QR (Sprint 2), a ReliefConnect QR carries the household's reference number
    router.push({ pathname: '/verification', params: { reference: data.trim(), method: 'qr' } });
  };

  // still checking permission
  if (!permission) {
    return <View style={styles.black} />;
  }

  // permission not given yet
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar style="dark" />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          ReliefConnect uses the camera to scan residents' QR codes during distribution.
        </Text>
        <View style={styles.permissionActions}>
          <PrimaryButton title="Allow Camera" onPress={requestPermission} />
          <PrimaryButton title="Go Back" variant="outline" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />

      {/* darkens the camera slightly so white text stays readable */}
      <View style={styles.scrim} pointerEvents="none" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={16} color={colors.white} strokeWidth={2} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Scan Resident QR</Text>
            <Text style={styles.subtitle}>Align QR Code within the brackets</Text>
          </View>
        </View>

        {/* viewfinder */}
        <View style={styles.viewfinder} pointerEvents="none">
          <View style={styles.brackets}>
            <Scan size={180} color={colors.white} strokeWidth={1} style={{ opacity: 0.8 }} />
          </View>
        </View>

        {/* bottom */}
        <View style={styles.bottom}>
          {/* adviser requirement: remind staff to check the physical items */}
          <View style={styles.reminder}>
            <TriangleAlert size={16} color={colors.yellow} strokeWidth={2} />
            <Text style={styles.reminderText}>
              Double-check the physical relief items before confirming the release.
            </Text>
          </View>

          <Text style={styles.hint}>Place the resident's digital or printed QR code inside the frame.</Text>
          <Pressable
            style={({ pressed }) => [styles.torchBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setTorchOn((v) => !v)}
          >
            {torchOn ? (
              <FlashlightOff size={16} color={colors.white} strokeWidth={2} />
            ) : (
              <Flashlight size={16} color={colors.white} strokeWidth={2} />
            )}
            <Text style={styles.torchText}>Toggle Flashlight</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlay: { flex: 1, justifyContent: 'space-between' },

  header: { height: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: {
    width: 36,
    height: 32,
    borderRadius: 16,
    backgroundColor: GLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.white },
  subtitle: { fontFamily: fonts.medium, fontSize: 11, color: colors.white },

  viewfinder: { alignItems: 'center' },
  brackets: {
    width: 220,
    height: 220,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottom: { alignItems: 'center', paddingHorizontal: 40, paddingBottom: 24, gap: 16 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: colors.yellow,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reminderText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.white },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 17, color: colors.white, opacity: 0.8, textAlign: 'center' },
  torchBtn: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: GLASS,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  torchText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },

  permissionScreen: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', gap: 12 },
  permissionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  permissionText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  permissionActions: { marginTop: 12, gap: 12 },
});