// src/app/household-step1.tsx  —  Figma frame: resident-household-step1
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import ProgressBar from '../components/ProgressBar';
import MemberCard, { Member } from '../components/MemberCard';
import PrimaryButton from '../components/PrimaryButton';
import { colors, fonts } from '../constants/theme';

const newMember = (): Member => ({
  id: `${Date.now()}-${Math.random()}`,
  name: '',
  age: '',
  relationship: '',
  idNumber: '',
});

export default function HouseholdStep1() {
  const { fullName, contact } = useLocalSearchParams<{ fullName: string; contact: string }>();
  const [members, setMembers] = useState<Member[]>([newMember()]);

  const updateMember = (id: string, field: keyof Omit<Member, 'id'>, value: string) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));

  const addMember = () => setMembers((prev) => [...prev, newMember()]);

  const handleNext = () => {
    const incomplete = members.some((m) => !m.name.trim() || !m.age || !m.relationship.trim());
    if (incomplete) {
      return Alert.alert(
        'Incomplete member details',
        'Please enter the name, age, and relationship for each family member, or remove empty entries.'
      );
    }
    router.push({
      pathname: '/household-step2',
      params: { fullName, contact, members: JSON.stringify(members) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title="Household Profile" subtitle="Step 1 of 3" />
        <ProgressBar step={1} total={3} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Head of household card */}
          <View style={styles.headCard}>
            <Text style={styles.headLabel}>Head of Household</Text>
            <Text style={styles.headName}>{fullName}</Text>
            <Text style={styles.headContact}>Contact: {contact}</Text>
          </View>

          {members.map((member, index) => (
            <MemberCard
              key={member.id}
              member={member}
              index={index}
              onChange={(field, value) => updateMember(member.id, field, value)}
              onRemove={() => removeMember(member.id)}
            />
          ))}

          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
            onPress={addMember}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.addText}>Add Family Member</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Next" onPress={handleNext} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, gap: 16 },

  headCard: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 16, gap: 6 },
  headLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  headName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  headContact: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },

  addButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },

  footer: { paddingHorizontal: 20, paddingBottom: 24 },
});