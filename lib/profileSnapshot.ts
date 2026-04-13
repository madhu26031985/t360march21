import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export type ProfileSnapshot = {
  full_name: string;
  email: string;
  phone_number: string;
  location: string;
  About: string;
  avatar_url: string | null;
  facebook_url: string;
  linkedin_url: string;
  instagram_url: string;
  twitter_url: string;
  youtube_url: string;
};

const MEM_TTL_MS = 90_000;
const PERSIST_TTL_MS = 12 * 60 * 60 * 1000;
const KEY_PREFIX = 'profileSnapshot:v1:';

let mem: { userId: string; at: number; value: ProfileSnapshot } | null = null;

function normalize(raw: Record<string, unknown> | null | undefined): ProfileSnapshot | null {
  if (!raw) return null;
  return {
    full_name: String(raw.full_name ?? ''),
    email: String(raw.email ?? ''),
    phone_number: String(raw.phone_number ?? ''),
    location: String(raw.location ?? ''),
    About: String(raw.About ?? ''),
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : null,
    facebook_url: String(raw.facebook_url ?? ''),
    linkedin_url: String(raw.linkedin_url ?? ''),
    instagram_url: String(raw.instagram_url ?? ''),
    twitter_url: String(raw.twitter_url ?? ''),
    youtube_url: String(raw.youtube_url ?? ''),
  };
}

async function readPersisted(userId: string): Promise<{ at: number; value: ProfileSnapshot } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; value?: ProfileSnapshot };
    if (!parsed?.at || !parsed?.value) return null;
    if (Date.now() - parsed.at > PERSIST_TTL_MS) return null;
    return { at: parsed.at, value: parsed.value };
  } catch {
    return null;
  }
}

async function writePersisted(userId: string, value: ProfileSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // ignore cache write issues
  }
}

export async function getCachedProfileSnapshot(userId: string): Promise<ProfileSnapshot | null> {
  if (mem?.userId === userId && Date.now() - mem.at < PERSIST_TTL_MS) {
    return mem.value;
  }
  const persisted = await readPersisted(userId);
  if (!persisted) return null;
  mem = { userId, at: persisted.at, value: persisted.value };
  return persisted.value;
}

export async function fetchProfileSnapshot(
  userId: string,
  opts?: { bypassCache?: boolean }
): Promise<ProfileSnapshot | null> {
  if (!opts?.bypassCache && mem?.userId === userId && Date.now() - mem.at < MEM_TTL_MS) {
    return mem.value;
  }
  if (!opts?.bypassCache) {
    const persisted = await readPersisted(userId);
    if (persisted && Date.now() - persisted.at < MEM_TTL_MS) {
      mem = { userId, at: persisted.at, value: persisted.value };
      return persisted.value;
    }
  }

  const { data, error } = await supabase
    .from('app_user_profiles')
    .select(
      'full_name, email, phone_number, location, About, avatar_url, facebook_url, linkedin_url, instagram_url, twitter_url, youtube_url'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  const value = normalize((data ?? null) as Record<string, unknown> | null);
  if (!value) return null;
  mem = { userId, at: Date.now(), value };
  void writePersisted(userId, value);
  return value;
}

export function prefetchProfileSnapshot(userId: string | null | undefined): void {
  if (!userId) return;
  void fetchProfileSnapshot(userId).catch(() => {});
}

