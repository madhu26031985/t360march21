import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseAuthUrl?: string;
};

const supabaseExtra = Constants.expoConfig?.extra as SupabaseExtra | undefined;

/**
 * Supabase Realtime opens `wss://<host>/realtime/v1/websocket` using the same host as REST.
 * If `EXPO_PUBLIC_SUPABASE_URL` is an HTTP proxy (e.g. Cloudflare Worker) that does not
 * forward WebSocket upgrades to Supabase, the browser shows "WebSocket connection failed".
 *
 * Fix options:
 * 1) Point `EXPO_PUBLIC_SUPABASE_URL` at `https://<project-ref>.supabase.co` (works for web + mobile).
 * 2) Or set `EXPO_PUBLIC_SUPABASE_WEB_URL` to `https://<project-ref>.supabase.co` so **web** uses the
 *    real project host for REST + Auth + Realtime while mobile can keep using the proxy if needed.
 */
function resolveSupabaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '').trim() || '';
  const fromExtra = supabaseExtra?.supabaseUrl?.replace(/\/$/, '').trim() || '';
  const base = fromEnv || fromExtra;
  const webOverride = process.env.EXPO_PUBLIC_SUPABASE_WEB_URL?.replace(/\/$/, '').trim();

  if (Platform.OS === 'web' && webOverride) {
    return webOverride;
  }
  return base;
}

function resolveSupabaseAuthUrl(): string {
  const directAuthEnv = process.env.EXPO_PUBLIC_SUPABASE_AUTH_URL?.replace(/\/$/, '').trim() || '';
  const directAuthExtra = supabaseExtra?.supabaseAuthUrl?.replace(/\/$/, '').trim() || '';
  const webOverride = process.env.EXPO_PUBLIC_SUPABASE_WEB_URL?.replace(/\/$/, '').trim() || '';
  const base = resolveSupabaseUrl();

  if (directAuthEnv) return directAuthEnv;
  if (directAuthExtra) return directAuthExtra;
  if (/\.supabase\.co$/i.test(new URL(base).host)) return base;
  if (webOverride && /\.supabase\.co$/i.test(new URL(webOverride).host)) return webOverride;
  return base;
}

// Configuration
/** Resolved API base (same host the client uses — important for Edge Functions on web with EXPO_PUBLIC_SUPABASE_WEB_URL). */
export const supabaseUrl = resolveSupabaseUrl();
export const supabaseAuthUrl = resolveSupabaseAuthUrl();
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    supabaseExtra?.supabaseAnonKey?.trim() ||
    '') as string;

if (!supabaseUrl || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in a root `.env` file, or set expo.extra.supabaseUrl and expo.extra.supabaseAnonKey in app.json (see README). Then restart the dev server.'
  );
}

// Create Supabase client
export const supabase = createClient<Database>(
  supabaseUrl,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: AsyncStorage,
    },
    global: {
      headers: {
        'X-Client-Info': 'toastmaster360-mobile',
      },
    },
  }
);

/**
 * Auth-only client used to generate OAuth URLs against the canonical Supabase auth host.
 * This avoids mobile sign-in prompts showing proxy domains like `workers.dev`.
 */
export const supabaseAuth = createClient<Database>(
  supabaseAuthUrl,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: AsyncStorage,
    },
    global: {
      headers: {
        'X-Client-Info': 'toastmaster360-mobile-auth',
      },
    },
  }
);