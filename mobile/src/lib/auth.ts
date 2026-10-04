// src/lib/auth.ts  —  login, sign-up and logout for residents and distribution staff
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { api, tokenStore, ApiError } from './api';
import { clearOfflineData } from './offline';

export type Role = 'resident' | 'distribution_personnel' | 'barangay_admin' | 'municipal_admin';

export type User = {
  id: number;
  name: string;
  role: Role;
  phone: string | null;
  username: string | null;
  position: string | null;
  barangay: { id: number; name: string } | null;
};

const deviceName = () => `${Device.modelName ?? Platform.OS} (ReliefConnect app)`;

/** Logs in and keeps the token only if the account has the expected role. */
export async function login(loginId: string, password: string, role: Role): Promise<User> {
  const res = await api<{ token: string; user: User }>('/login', {
    body: { login: loginId.trim(), password, device_name: deviceName() },
  });
  if (res.user.role !== role) {
    // Use this token once to revoke it, then refuse
    await tokenStore.set(res.token);
    await api('/logout', { method: 'POST' }).catch(() => {});
    await tokenStore.clear();
    throw new ApiError(403, role === 'resident'
      ? 'This account is not a resident account. Staff should use the staff login.'
      : 'This account is not a distribution staff account.');
  }
  await tokenStore.set(res.token);
  return res.user;
}

export async function register(name: string, phone: string, password: string): Promise<User> {
  const res = await api<{ token: string; user: User }>('/register', {
    body: { name: name.trim(), phone, password, device_name: deviceName() },
  });
  await tokenStore.set(res.token);
  return res.user;
}

/** The logged-in user, or null if there is no valid saved session. */
export async function currentUser(): Promise<User | null> {
  if (!(await tokenStore.get())) return null;
  try {
    return await api<User>('/me');
  } catch {
    return null;
  }
}

export async function logout() {
  await api('/logout', { method: 'POST' }).catch(() => {}); // still log out locally if offline
  await tokenStore.clear();
  await clearOfflineData(); // offline mode: household lists don't stay on the phone after logout
}

/** Change the password of the logged-in resident or staff. Other devices are logged out by the server. */
export async function changePassword(currentPassword: string, password: string, confirmation: string) {
  await api('/me/password', {
    body: { current_password: currentPassword, password, password_confirmation: confirmation },
  });
}
