// src/lib/api.ts  —  the only place that talks to the Laravel API
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Set in mobile/.env, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api (the laptop running Laravel)
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');

const TOKEN_KEY = 'rc_token';
const TIMEOUT_MS = 20000;

/** The login token lives in the phone's encrypted storage (localStorage on Expo web). */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(TOKEN_KEY, token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear() {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;    // sent as JSON
  form?: FormData;   // sent as multipart (file uploads)
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number; // uploads need longer than normal requests
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const token = await tokenStore.get();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: any;
  if (opts.form) {
    body = opts.form; // fetch sets the multipart boundary itself
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const qs = opts.query
    ? '?' + Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method: opts.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, timedOut
      ? 'The server took too long to respond. If you are uploading photos, try a stronger connection and submit again.'
      : `Can't reach the ReliefConnect server (${API_URL}). Check your internet connection and try again.`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (res.status === 401) await tokenStore.clear(); // expired or logged out elsewhere

  if (!res.ok) {
    const first = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
    throw new ApiError(res.status, first ?? data?.message ?? `Request failed (${res.status}).`, data?.errors);
  }
  return data as T;
}

/** Text for an Alert from any thrown error. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/** "1 Pack", "2 Packs": units are stored in plural form. */
export const qtyUnit = (qty: number, unit: string) =>
  `${qty} ${qty === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit}`;
