// src/context/ResidentContext.tsx
// Holds the logged-in resident's household so every screen can read it.
import { createContext, useContext, useState, ReactNode } from 'react';
import { Household } from '../data/household';

type ResidentContextValue = {
  household: Household | null;
  setHousehold: (household: Household | null) => void;
};

const ResidentContext = createContext<ResidentContextValue | null>(null);

export function ResidentProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  return (
    <ResidentContext.Provider value={{ household, setHousehold }}>
      {children}
    </ResidentContext.Provider>
  );
}

export function useResident() {
  const ctx = useContext(ResidentContext);
  if (!ctx) throw new Error('useResident must be used inside ResidentProvider');
  return ctx;
}