// src/components/MemberCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Trash } from 'lucide-react-native';
import FormInput from './FormInput';
import { colors, fonts } from '../constants/theme';

export type Member = {
  id: string;
  name: string;
  age: string;
  relationship: string;
  idNumber: string;
};

type Props = {
  member: Member;
  index: number;
  onChange: (field: keyof Omit<Member, 'id'>, value: string) => void;
  onRemove: () => void;
};

export default function MemberCard({ member, index, onChange, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Family Member #{index + 1}</Text>
        <Pressable onPress={onRemove} hitSlop={12}>
          <Trash size={16} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      <FormInput
        label="Name"
        placeholder="Full name"
        value={member.name}
        onChangeText={(v) => onChange('name', v)}
        autoCapitalize="words"
      />

      <View style={styles.row}>
        <FormInput
          label="Age"
          placeholder="0"
          value={member.age}
          onChangeText={(v) => onChange('age', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          containerStyle={styles.col}
        />
        <FormInput
          label="Relationship"
          placeholder="e.g. Spouse"
          value={member.relationship}
          onChangeText={(v) => onChange('relationship', v)}
          containerStyle={styles.col}
        />
      </View>

      <FormInput
        label="ID Number"
        placeholder="e.g. PhilSys, UMID, TIN"
        value={member.idNumber}
        onChangeText={(v) => onChange('idNumber', v)}
      />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.blue },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
});