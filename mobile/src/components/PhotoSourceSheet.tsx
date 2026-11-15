// src/components/PhotoSourceSheet.tsx  —  bottom sheet: "Take a photo" or "Choose from gallery" (replaces the grey Android box)
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onPick: (source: 'camera' | 'library') => void;
};

const OFFSET = 360;

function Choice({ Icon, title, hint, onPress }: { Icon: LucideIcon; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.choiceIcon}>
        <Icon size={28} color={colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceHint}>{hint}</Text>
    </Pressable>
  );
}

export default function PhotoSourceSheet({ visible, title, subtitle, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(OFFSET)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slide, { toValue: OFFSET, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  // Close first, then open the camera or gallery, so the sheet isn't left on screen behind it
  const pick = (source: 'camera' | 'library') => {
    onClose();
    setTimeout(() => onPick(source), 220);
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: slide }] }]}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.choices}>
          <Choice Icon={Camera} title="Take a photo" hint="Use your camera now" onPress={() => pick('camera')} />
          <Choice Icon={Images} title="From gallery" hint="Pick a saved photo" onPress={() => pick('library')} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(30,42,47,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, gap: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  subtitle: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', gap: 12 },
  choice: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 10,
    borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  choicePressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  choiceIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  choiceTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  choiceHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
