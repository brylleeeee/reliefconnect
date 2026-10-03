// src/context/ResidentContext.tsx
// Holds the logged-in resident and their household so every screen can read them.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Household, fetchMyHousehold } from '../data/household';
import type { User } from '../lib/auth';

type ResidentContextValue = {
  user: User | null;
  setUser: (user: User | null) => void;
  household: Household | null;
  setHousehold: (household: Household | null) => void;
  /** Reloads the household from the server (e.g. to see an approval). */
  refresh: () => Promise<Household | null>;
};

const ResidentContext = createContext<ResidentContextValue | null>(null);

export function ResidentProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);

  const refresh = useCallback(async () => {
    const h = await fetchMyHousehold();
    setHousehold(h);
    return h;
  }, []);

  return (
    <ResidentContext.Provider value={{ user, setUser, household, setHousehold, refresh }}>
      {children}
    </ResidentContext.Provider>
  );
}

export function useResident() {
  const ctx = useContext(ResidentContext);
  if (!ctx) throw new Error('useResident must be used inside ResidentProvider');
  return ctx;
}
