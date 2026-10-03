// src/components/MemberCard.tsx
// One household member. The fields match what the barangay needs for priority scoring:
// birthdate (seniors, infants), sex, PWD and pregnancy.
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { Trash } from 'lucide-react-native';
import FormInput from './FormInput';
import { Member, RELATIONSHIPS } from '../data/household';
import { colors, fonts } from '../constants/theme';

export type { Member };

type Props = {
  member: Member;
  title: string;
  isHead?: boolean;
  onChange: (patch: Partial<Member>) => void;
  onRemove?: () => void;
};

/** Types digits only and inserts the dashes: 19850423 → 1985-04-23 */
function formatBirthdate(input: string) {
  const d = input.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function MemberCard({ member, title, isHead, onChange, onRemove }: Props) {
  return (
    <View style={[styles.card, isHead && styles.headCard]}>
      <View style={styles.header}>
        <Text style={[styles.title, isHead && { color: colors.primary }]}>{title}</Text>
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={12} accessibilityLabel="Remove member">
            <Trash size={16} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      <FormInput
        label="Full Name"
        placeholder="As written on their ID or birth certificate"
        value={member.name}
        onChangeText={(v) => onChange({ name: v })}
        autoCapitalize="words"
      />

      {!isHead && (
        <View style={styles.field}>
          <Text style={styles.label}>Relationship to Head</Text>
          <View style={styles.chips}>
            {RELATIONSHIPS.map((r) => (
              <Chip key={r} label={r} active={member.relationship === r} onPress={() => onChange({ relationship: r })} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.row}>
        <FormInput
          label="Birthdate"
          placeholder="YYYY-MM-DD"
          value={member.birthdate}
          onChangeText={(v) => onChange({ birthdate: formatBirthdate(v) })}
          keyboardType="number-pad"
          maxLength={10}
          containerStyle={styles.col}
        />
        <View style={[styles.field, styles.col]}>
          <Text style={styles.label}>Sex</Text>
          <View style={styles.sexRow}>
            <Chip label="Male" active={member.sex === 'M'} onPress={() => onChange({ sex: 'M', isPregnant: false })} />
            <Chip label="Female" active={member.sex === 'F'} onPress={() => onChange({ sex: 'F' })} />
          </View>
        </View>
      </View>

      <Toggle label="Person with disability (PWD)" value={member.isPwd} onChange={(v) => onChange({ isPwd: v })} />
      {member.sex === 'F' && (
        <Toggle label="Currently pregnant" value={member.isPregnant} onChange={(v) => onChange({ isPregnant: v })} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  headCard: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sexRow: { flexDirection: 'row', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.white, fontFamily: fonts.semibold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  toggleLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flex: 1, paddingRight: 12 },
});
