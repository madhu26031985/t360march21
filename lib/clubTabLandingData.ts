/**
 * Critical above-the-fold data for the Club tab: one clubs+profiles query path,
 * members roster, and ExComm profiles — with a short in-memory cache for instant
 * repeat visits / Home → Club navigation.
 */

import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchClubInfoManagementBundle,
  type ClubExcommSlot,
  type ClubInfoManagementBundle,
} from '@/lib/clubInfoManagementQuery';
import type { ClubTabFaqItem, ClubTabSecondaryPayload, ClubTabSessionSnapshot } from '@/lib/clubTabSessionCache';
import { writeClubTabSession } from '@/lib/clubTabSessionCache';

const CACHE_TTL_MS = 90_000;
const PERSISTED_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const PERSISTED_CACHE_PREFIX = 'clubLandingCritical:v1:';

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

function toStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function parseRpcPayload(raw: unknown): ClubLandingCriticalPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const bundleRaw = root.bundle as Record<string, unknown> | undefined;
  if (!bundleRaw || typeof bundleRaw !== 'object') return null;

  const clubInfoRaw = bundleRaw.clubInfo as Record<string, unknown> | undefined;
  const clubDataRaw = bundleRaw.clubData as Record<string, unknown> | undefined;
  const scheduleRaw = bundleRaw.meetingSchedule as Record<string, unknown> | undefined;
  const socialRaw = bundleRaw.social as Record<string, unknown> | undefined;
  const excommSlotsRaw = Array.isArray(bundleRaw.excommSlots) ? bundleRaw.excommSlots : [];
  const excommRaw = Array.isArray(root.excomm) ? root.excomm : [];
  const membersRaw = Array.isArray(root.members) ? root.members : [];

  if (!clubInfoRaw?.id || !clubInfoRaw?.name || !clubDataRaw || !scheduleRaw) return null;

  const excommSlots: ClubExcommSlot[] = excommSlotsRaw
    .map((x) => {
      const r = x as Record<string, unknown>;
      const key = toStringOrNull(r.key);
      const title = toStringOrNull(r.title);
      const userId = toStringOrNull(r.userId);
      if (!key || !title || !userId) return null;
      return { key, title, userId };
    })
    .filter(Boolean) as ClubExcommSlot[];

  const excomm: ExcommPreviewRow[] = excommRaw
    .map((x) => {
      const r = x as Record<string, unknown>;
      const m = r.member as Record<string, unknown> | undefined;
      const key = toStringOrNull(r.key);
      const title = toStringOrNull(r.title);
      const id = toStringOrNull(m?.id);
      if (!key || !title || !id) return null;
      return {
        key,
        title,
        member: {
          id,
          full_name: toStringOrNull(m?.full_name) ?? 'Member',
          avatar_url: toStringOrNull(m?.avatar_url),
        },
      };
    })
    .filter(Boolean) as ExcommPreviewRow[];

  const members: MemberPreview[] = membersRaw
    .map((x) => {
      const r = x as Record<string, unknown>;
      const id = toStringOrNull(r.id);
      if (!id) return null;
      return {
        id,
        full_name: toStringOrNull(r.full_name) ?? 'Member',
        avatar_url: toStringOrNull(r.avatar_url),
        clubRole: normalizeClubMemberPreviewRole(toStringOrNull(r.clubRole)),
      };
    })
    .filter(Boolean) as MemberPreview[];

  return {
    bundle: {
      clubInfo: {
        id: String(clubInfoRaw.id),
        name: String(clubInfoRaw.name),
        club_number: toStringOrNull(clubInfoRaw.club_number),
        charter_date: toStringOrNull(clubInfoRaw.charter_date),
      },
      clubData: {
        club_name: toStringOrNull(clubDataRaw.club_name) ?? String(clubInfoRaw.name),
        club_number: toStringOrNull(clubDataRaw.club_number),
        charter_date: toStringOrNull(clubDataRaw.charter_date),
        club_status: toStringOrNull(clubDataRaw.club_status),
        club_type: toStringOrNull(clubDataRaw.club_type),
        club_mission: toStringOrNull(clubDataRaw.club_mission),
        banner_color: toStringOrNull(clubDataRaw.banner_color),
        city: toStringOrNull(clubDataRaw.city),
        country: toStringOrNull(clubDataRaw.country),
        region: toStringOrNull(clubDataRaw.region),
        district: toStringOrNull(clubDataRaw.district),
        division: toStringOrNull(clubDataRaw.division),
        area: toStringOrNull(clubDataRaw.area),
        time_zone: toStringOrNull(clubDataRaw.time_zone),
        address: toStringOrNull(clubDataRaw.address),
        pin_code: toStringOrNull(clubDataRaw.pin_code),
        google_location_link: toStringOrNull(clubDataRaw.google_location_link),
      },
      meetingSchedule: {
        meeting_day: toStringOrNull(scheduleRaw.meeting_day),
        meeting_frequency: toStringOrNull(scheduleRaw.meeting_frequency),
        meeting_start_time: toStringOrNull(scheduleRaw.meeting_start_time),
        meeting_end_time: toStringOrNull(scheduleRaw.meeting_end_time),
        meeting_type: toStringOrNull(scheduleRaw.meeting_type),
        online_meeting_link: toStringOrNull(scheduleRaw.online_meeting_link),
      },
      social: socialRaw
        ? {
            facebook_url: toStringOrNull(socialRaw.facebook_url),
            twitter_url: toStringOrNull(socialRaw.twitter_url),
            linkedin_url: toStringOrNull(socialRaw.linkedin_url),
            instagram_url: toStringOrNull(socialRaw.instagram_url),
            whatsapp_url: toStringOrNull(socialRaw.whatsapp_url),
            youtube_url: toStringOrNull(socialRaw.youtube_url),
            website_url: toStringOrNull(socialRaw.website_url),
          }
        : null,
      excommSlots,
    },
    excomm,
    members,
  };
}

let cache: { clubId: string; at: number; data: ClubLandingCriticalPayload } | null = null;

export function invalidateClubLandingCriticalCache() {
  cache = null;
}

/** Synchronous read of in-memory critical cache (for instant Club tab hydrate). */
export function peekClubLandingCriticalCache(clubId: string): ClubLandingCriticalPayload | null {
  if (cache?.clubId === clubId) return cache.data;
  return null;
}

async function readPersistedCritical(
  clubId: string
): Promise<{ at: number; data: ClubLandingCriticalPayload } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PERSISTED_CACHE_PREFIX}${clubId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: ClubLandingCriticalPayload };
    if (!parsed?.at || !parsed?.data) return null;
    if (Date.now() - parsed.at > PERSISTED_CACHE_TTL_MS) return null;
    return { at: parsed.at, data: parsed.data };
  } catch {
    return null;
  }
}

async function writePersistedCritical(clubId: string, data: ClubLandingCriticalPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${PERSISTED_CACHE_PREFIX}${clubId}`,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    // Ignore cache write failures.
  }
}

/** Read warm critical payload from memory/disk cache. */
export async function getCachedClubLandingCritical(
  clubId: string
): Promise<ClubLandingCriticalPayload | null> {
  if (cache?.clubId === clubId && Date.now() - cache.at < PERSISTED_CACHE_TTL_MS) {
    return cache.data;
  }
  const persisted = await readPersistedCritical(clubId);
  if (!persisted) return null;
  cache = { clubId, at: persisted.at, data: persisted.data };
  return persisted.data;
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

  if (!opts?.bypassCache) {
    const persisted = await readPersistedCritical(clubId);
    // Match readPersistedCritical TTL (12h): short CACHE_TTL_MS here forced a network RPC on almost every Club open.
    if (persisted && Date.now() - persisted.at < PERSISTED_CACHE_TTL_MS) {
      cache = { clubId, at: persisted.at, data: persisted.data };
      return persisted.data;
    }
  }

  let data: ClubLandingCriticalPayload | null = null;

  try {
    const { data: rpcData, error } = await supabase.rpc('get_club_landing_critical_snapshot', {
      p_club_id: clubId,
      p_member_limit: 24,
    });
    if (!error) {
      data = parseRpcPayload(rpcData);
    }
  } catch {
    data = null;
  }

  if (!data) {
    const [bundle, members] = await Promise.all([
      fetchClubInfoManagementBundle(clubId),
      fetchClubMembersPreview(clubId, 24),
    ]);
    const excomm = await resolveExcommPreview(bundle.excommSlots);
    data = { bundle, excomm, members };
  }

  cache = { clubId, at: Date.now(), data };
  void writePersistedCritical(clubId, data);
  return data;
}

/** Fire-and-forget prefetch from Home (or elsewhere) so Club opens instantly. */
export function prefetchClubLandingCritical(clubId: string | null | undefined): void {
  prefetchClubTabSession(clubId);
}

export async function fetchClubFaqItems(clubId: string): Promise<ClubTabFaqItem[]> {
  const { data, error } = await supabase
    .from('club_faq_items')
    .select('id, question, answer')
    .eq('club_id', clubId)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('Club FAQ load:', error.message);
    return [];
  }
  const faqRows = (data as Array<{ id: string; question: string | null; answer: string | null }> | null) ?? [];
  return faqRows
    .filter((r) => (r.question?.trim() || r.answer?.trim()))
    .map((r) => ({
      id: r.id,
      question: (r.question ?? '').trim(),
      answer: (r.answer ?? '').trim(),
    }));
}

/** One RPC for Club tab carousels / meeting insights (last N months). */
export async function fetchClubTabSecondarySnapshot(
  clubId: string,
  months = 6
): Promise<ClubTabSecondaryPayload | null> {
  try {
    const { data, error } = await supabase.rpc('get_club_tab_secondary_snapshot', {
      p_club_id: clubId,
      p_months: months,
    });
    if (error || !data || typeof data !== 'object') {
      if (error) console.warn('Club secondary snapshot RPC:', error.message);
      return null;
    }
    const root = data as Record<string, unknown>;
    return {
      educationalSpeeches: (root.educationalSpeeches as unknown[]) ?? [],
      toastmasterThemes: (root.toastmasterThemes as unknown[]) ?? [],
      preparedSpeeches: (root.preparedSpeeches as unknown[]) ?? [],
      quoteRows: (root.quoteRows as unknown[]) ?? [],
      idiomRows: (root.idiomRows as unknown[]) ?? [],
      wotdRows: (root.wotdRows as unknown[]) ?? [],
      timerMeetingWiseRows: (root.timerMeetingWiseRows as unknown[]) ?? [],
      ahCounterMeetingWiseRows: (root.ahCounterMeetingWiseRows as unknown[]) ?? [],
      tableTopicQuestionRows: (root.tableTopicQuestionRows as unknown[]) ?? [],
      generalEvaluatorScoringRows: (root.generalEvaluatorScoringRows as unknown[]) ?? [],
      faqItems: [],
    };
  } catch (e) {
    console.warn('Club secondary snapshot RPC load error:', e);
    return null;
  }
}

/** Prefetch critical + secondary into session cache before user opens Club tab. */
export function prefetchClubTabSession(clubId: string | null | undefined): void {
  if (!clubId) return;
  void (async () => {
    try {
      const [critical, hasCompleted] = await Promise.all([
        fetchClubLandingCritical(clubId),
        fetchClubHasCompletedMeeting(clubId),
      ]);
      let secondary: ClubTabSecondaryPayload | null = null;
      if (hasCompleted) {
        const snap = await fetchClubTabSecondarySnapshot(clubId);
        if (snap) {
          secondary = { ...snap, faqItems: await fetchClubFaqItems(clubId) };
        }
      }
      const snapshot: ClubTabSessionSnapshot = {
        clubId,
        at: Date.now(),
        hasCompletedMeeting: hasCompleted,
        critical,
        secondary,
      };
      writeClubTabSession(snapshot);
    } catch {
      /* ignore prefetch errors */
    }
  })();
}

/** True when the club has at least one closed (completed) meeting. */
export async function fetchClubHasCompletedMeeting(clubId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('app_club_meeting')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('meeting_status', 'close');

    if (error) {
      console.warn('Club completed meeting check:', error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (e) {
    console.warn('Club completed meeting check error:', e);
    return false;
  }
}
