// src/components/AlertHost.tsx  —  draws showAlert() dialogs in the app's style (mounted once in the root layout)
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, StyleSheet } from 'react-native';
import { CircleCheck, TriangleAlert, CircleX, Info, CircleHelp } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { subscribeAlerts, dismissAlert, AlertRequest, AlertTone, AlertButton } from '../lib/appAlert';
import { colors, fonts } from '../constants/theme';

const TONE: Record<AlertTone, { Icon: LucideIcon; fg: string; bg: string }> = {
  success: { Icon: CircleCheck, fg: colors.primary, bg: colors.primaryTint },
  warning: { Icon: TriangleAlert, fg: '#B7791F', bg: '#FDF6E3' },
  error: { Icon: CircleX, fg: colors.danger, bg: colors.dangerTint },
  info: { Icon: Info, fg: colors.blue, bg: colors.blueTint },
  question: { Icon: CircleHelp, fg: colors.primary, bg: colors.primaryTint },
};

export default function AlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const pop = useRef(new Animated.Value(0)).current;
  const current = queue[0];

  useEffect(() => subscribeAlerts(setQueue), []);

  // Small "pop" each time a new dialog appears
  useEffect(() => {
    if (!current) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [current?.id, pop]);

  if (!current) return null;

  const tone = TONE[current.tone];
  const cancelBtn = current.buttons.find((b) => b.style === 'cancel');
  const others = current.buttons.filter((b) => b !== cancelBtn);
  // One or two choices sit side by side; three or more stack, like a menu
  const stacked = current.buttons.length > 2;

  const press = (b?: AlertButton) => {
    dismissAlert(current.id);
    // Let the dialog close first, so a follow-up alert or screen change isn't swallowed
    if (b?.onPress) setTimeout(() => { b.onPress?.(); }, 50);
  };

  const mainColor = (b: AlertButton) => (b.style === 'destructive' ? colors.danger : colors.primary);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => press(cancelBtn)}>
      <View style={styles.backdrop}>
        {/* Tapping outside only closes it when there is a Cancel choice or a single OK */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => (cancelBtn ? press(cancelBtn) : current.buttons.length === 1 ? press(current.buttons[0]) : null)}
        />

        <Animated.View
          style={[styles.card, {
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View style={[styles.iconBg, { backgroundColor: tone.bg }]}>
            <tone.Icon size={28} color={tone.fg} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {stacked ? (
              <>
                {others.map((b, i) => (
                  <Pressable
                    key={b.text}
                    onPress={() => press(b)}
                    style={({ pressed }) => [styles.btn, i === 0 ? { backgroundColor: mainColor(b) } : styles.outline,
                      pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.btnText, { color: i === 0 ? colors.white : mainColor(b) }]}>{b.text}</Text>
                  </Pressable>
                ))}
                {cancelBtn ? (
                  <Pressable onPress={() => press(cancelBtn)} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
                    <Text style={styles.linkText}>{cancelBtn.text}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                {cancelBtn ? (
                  <Pressable
                    onPress={() => press(cancelBtn)}
                    style={({ pressed }) => [styles.btn, styles.cancel, pressed && { backgroundColor: colors.background }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.btnText, { color: colors.text }]}>{cancelBtn.text}</Text>
                  </Pressable>
                ) : null}
                {others.map((b) => (
                  <Pressable
                    key={b.text}
                    onPress={() => press(b)}
                    style={({ pressed }) => [styles.btn, { backgroundColor: mainColor(b) }, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.btnText, { color: colors.white }]}>{b.text}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,42,47,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: 22,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  iconBg: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, lineHeight: 25, color: colors.text, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 14 },
  actionsStacked: { flexDirection: 'column' },
  btn: { flex: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.white },
  btnText: { fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' },
  link: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
});
