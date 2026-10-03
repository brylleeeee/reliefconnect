// src/app/(staff)/_layout.tsx
import { Stack } from 'expo-router';
import { StaffProvider } from '../../context/StaffContext';

export default function StaffLayout() {
  return (
    <StaffProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </StaffProvider>
  );
}
