/**
 * Critical above-the-fold data for the Club tab: one clubs+profiles query path,
 * members roster, and ExComm profiles — with a short in-memory cache for instant
 * repeat visits / Home → Club navigation.
 */

import { supabase } from '@/lib/supabase';
import {
  fetchClubInfoManagementBundle,
  type ClubInfoManagementBundle,
} from '@/lib/clubInfoManagementQuery';

const CACHE_TTL_MS = 90_000;

export type ExcommPreviewRow = {
  key: string;
  title: string;
  member: { id: string; full_name: string; avatar_url: string | null };
};

export type MemberPreviewClubRole = 'member' | 'visiting_tm' | 'guest';

export type MemberPreview = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  clubRole: MemberPreviewClubRole;
};

const PREVIEW_ROLES = ['member', 'visiting_tm', 'guest'] as const;

export function normalizeClubMemberPreviewRole(role: string | null | undefined): MemberPreviewClubRole {
  if (role === 'visiting_tm') return 'visiting_tm';
  if (role === 'guest') return 'guest';
  return 'member';
}

export type ClubLandingCriticalPayload = {
  bundle: ClubInfoManagementBundle;
  excomm: ExcommPreviewRow[];
  members: MemberPreview[];
};

let cache: { clubId: string; at: number; data: ClubLandingCriticalPayload } | null = null;

export function invalidateClubLandingCriticalCache() {
  cache = null;
}

async function resolveExcommPreview(slots: ClubInfoManagementBundle['excommSlots']): Promise<ExcommPreviewRow[]> {
  if (!slots.length) return [];
  const ids = slots.map((s) => s.userId);
  const { data: people, error } = await supabase
    .from('app_user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids);

  if (error || !people?.length) return [];

  return slots
    .map((s) => {
      const m = people.find((x) => x.id === s.userId);
      if (!m) return null;
      return {
        key: s.key,
        title: s.title,
        member: {
          id: m.id,
          full_name: m.full_name ?? 'Member',
          avatar_url: m.avatar_url ?? null,
        },
      };
    })
    .filter(Boolean) as ExcommPreviewRow[];
}

export async function fetchClubMembersPreview(clubId: string, limit: number): Promise<MemberPreview[]> {
  const { data, error } = await supabase
    .from('app_club_user_relationship')
    .select(
      `
      role,
      app_user_profiles (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('club_id', clubId)
    .eq('is_authenticated', true)
    .in('role', [...PREVIEW_ROLES])
    .limit(80);

  if (error || !data?.length) return [];

  const byId = new Map<string, MemberPreview>();
  for (const row of data) {
    const r = row as {
      role: string;
      app_user_profiles: { id: string; full_name: string; avatar_url: string | null } | null;
    };
    const prof = r.app_user_profiles;
    if (!prof?.id) continue;
    const clubRole = normalizeClubMemberPreviewRole(r.role);
    if (!byId.has(prof.id)) {
      byId.set(prof.id, {
        id: prof.id,
        full_name: prof.full_name ?? 'Member',
        avatar_url: prof.avatar_url ?? null,
        clubRole,
      });
    }
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return rows.slice(0, limit);
}

/**
 * Loads Club tab hero content. Uses a 90s in-memory cache per club id unless `bypassCache`.
 */
export async function fetchClubLandingCritical(
  clubId: string,
  opts?: { bypassCache?: boolean }
): Promise<ClubLandingCriticalPayload> {
  if (!opts?.bypassCache && cache?.clubId === clubId && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const [bundle, members] = await Promise.all([
    fetchClubInfoManagementBundle(clubId),
    fetchClubMembersPreview(clubId, 24),
  ]);

  const excomm = await resolveExcommPreview(bundle.excommSlots);

  const data: ClubLandingCriticalPayload = { bundle, excomm, members };
  cache = { clubId, at: Date.now(), data };
  return data;
}

/** Fire-and-forget prefetch from Home (or elsewhere) so Club opens instantly. */
export function prefetchClubLandingCritical(clubId: string | null | undefined): void {
  if (!clubId) return;
  void fetchClubLandingCritical(clubId).catch(() => {
    /* ignore prefetch errors */
  });
}
