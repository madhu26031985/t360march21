import { supabase } from '@/lib/supabase';

export interface MentorContact {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
}

export interface VpeSnapshot {
  id: string;
  full_name: string;
  phone_number: string | null;
}

export interface MyMentorSnapshot {
  club_name: string;
  mentor: MentorContact | null;
  vpe: VpeSnapshot | null;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: MyMentorSnapshot }>();

function cacheKey(clubId: string) {
  return `my-mentor:${clubId}`;
}

export function getCachedMyMentorSnapshot(clubId: string): MyMentorSnapshot | null {
  const key = cacheKey(clubId);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedMyMentorSnapshot(clubId: string, value: MyMentorSnapshot) {
  cache.set(cacheKey(clubId), { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function fetchMyMentorSnapshot(clubId: string): Promise<MyMentorSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_my_mentor_snapshot', {
    p_club_id: clubId,
  });
  if (error || !data || typeof data !== 'object') return null;
  const parsed = data as MyMentorSnapshot;
  setCachedMyMentorSnapshot(clubId, parsed);
  return parsed;
}

export function prefetchMyMentorSnapshot(clubId: string | null | undefined): void {
  if (!clubId) return;
  void fetchMyMentorSnapshot(clubId);
}
