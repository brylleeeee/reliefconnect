// src/constants/theme.ts
export const colors = {
  text: '#1E2A2F',
  textSecondary: '#5A6A70',
  muted: '#90A4AE',
  primary: '#2E7D6B',
  primaryTint: '#EAF2F1',
  danger: '#C0392B',
  dangerTint: '#FDEDEC',
  blue: '#2C5F8A',
  blueTint: '#EDF4F9',
  yellow: '#F1C40F',
  success: '#27AE60',
  successTint: '#E8F8F0',
  background: '#F7F9FA',
  white: '#FFFFFF',
  border: '#E2E8F0',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

import { useResident } from '../context/ResidentContext';
import { sampleHousehold } from '../data/household';