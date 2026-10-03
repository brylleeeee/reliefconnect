// src/components/UploadCard.tsx
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Upload } from 'lucide-react-native';
import { colors, fonts } from '../constants/theme';

type Props = {
  title: string;
  tint: string;       // circle background
  iconColor: string;  // upload icon color
  uri?: string | null;
  onPress: () => void;
};

export default function UploadCard({ title, tint, iconColor, uri, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: tint }]}>
          <Upload size={20} color={iconColor} strokeWidth={2} />
        </View>
      )}

      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.hint, uri ? styles.hintDone : null]}>
        {uri ? 'Uploaded · Tap to change' : 'Tap to Upload (Max 10MB, JPG/PNG)'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  hintDone: { fontFamily: fonts.semibold, color: colors.primary },
});