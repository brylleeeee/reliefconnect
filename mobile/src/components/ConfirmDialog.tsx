// src/components/ConfirmDialog.tsx  —  app-styled "Are you sure?" dialog (replaces Android's plain Alert)
import { useState, type ComponentType, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/theme';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

type Props = {
  visible: boolean;
  title: string;
  message: ReactNode;                // plain text, or <Text> with bold parts
  note?: string;                     // small muted line under the message
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;                 // red confirm button and icon (default: green)
  icon?: ComponentType<IconProps>;  // optional badge at the top; none if not given
  onCancel: () => void;
  onConfirm: () => void | Promise<void>; // while it runs, the buttons are locked and a spinner shows
};

/** Text styles for building a rich message, e.g. <Text style={confirmText.message}>Release <Text style={confirmText.bold}>1 Kit</Text>…</Text> */
export const confirmText = StyleSheet.create({
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  bold: { fontFamily: fonts.bold, color: colors.text },
});

export default function ConfirmDialog({
  visible, title, message, note, confirmLabel, cancelLabel = 'Cancel', danger = false, icon: Icon, onCancel, onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false);
  const tone = danger ? colors.danger : colors.primary;
  const tint = danger ? colors.dangerTint : colors.primaryTint;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { if (!busy) onCancel(); };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel={cancelLabel} />

        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          {Icon && (
            <View style={[styles.iconBg, { backgroundColor: tint }]}>
              <Icon size={26} color={tone} strokeWidth={2.2} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {typeof message === 'string' ? <Text style={styles.message}>{message}</Text> : message}
          {note ? <Text style={styles.note}>{note}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={cancel}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.cancel, pressed && { backgroundColor: colors.background }, busy && styles.dim]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={confirm}
              disabled={busy}
              style={({ pressed }) => [styles.btn, { backgroundColor: tone }, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityState={{ busy }}
            >
              {busy
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={[styles.btnText, { color: colors.white }]}>{confirmLabel}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(30,42,47,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: 22,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  iconBg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, textAlign: 'center', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 14 },
  btn: { flex: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  dim: { opacity: 0.5 },
  btnText: { fontFamily: fonts.semibold, fontSize: 15 },
});
