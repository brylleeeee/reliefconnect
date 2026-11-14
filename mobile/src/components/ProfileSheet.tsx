// src/components/ProfileSheet.tsx  —  rounded bottom sheet opened by tapping your name (replaces the plain Alert)
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, X } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = {
  visible: boolean;
  name: string;
  role: string;
  initials: string;
  onClose: () => void;
  onChangePassword: () => void;
  onLogout: () => void; // the screen's own logout handler (sync check + "Are you sure?" confirmation)
};

const SHEET_OFFSET = 400; // how far below the screen the sheet starts

export default function ProfileSheet({ visible, name, role, initials, onClose, onChangePassword, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Slide up when opened; slide down first, then unmount, when closed
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: SHEET_OFFSET, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  // Close the sheet first so the next screen or the logout confirmation isn't stacked on top of it
  const then = (action: () => void) => () => {
    onClose();
    setTimeout(action, 220);
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close profile menu" />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: slide }] }]}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />

        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.who}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>

        <Pressable
          onPress={then(onChangePassword)}
          style={({ pressed }) => [styles.btn, styles.outline, pressed && { backgroundColor: colors.primaryTint }]}
          accessibilityRole="button"
        >
          <KeyRound size={18} color={colors.primary} strokeWidth={2.2} />
          <Text style={[styles.btnText, { color: colors.primary }]}>Change Password</Text>
        </Pressable>

        <Pressable
          onPress={then(onLogout)}
          style={({ pressed }) => [styles.btn, styles.danger, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.white }]}>Log Out</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 28, 0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  close: {
    position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
  closePressed: { backgroundColor: colors.border },
  who: { alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 8 },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, maxWidth: '80%' },
  role: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  btn: { minHeight: 48, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.white },
  danger: { backgroundColor: colors.danger },
  btnText: { fontFamily: fonts.semibold, fontSize: 15 },
});
