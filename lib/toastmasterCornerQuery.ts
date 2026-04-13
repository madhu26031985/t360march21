import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ToastmasterCornerMeeting = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
};

export type ToastmasterCornerClubInfo = {
  id: string;
  name: string;
  club_number: string | null;
  charter_date: string | null;
};

export type ToastmasterOfDayRow = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status?: string;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
};

export type ToastmasterMeetingDataRow = {
  id: string;
  meeting_id: string;
  club_id: string;
  toastmaster_user_id: string;
  personal_notes: string | null;
  theme_of_the_day: string | null;
  theme_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ToastmasterCornerBundle = {
  meeting: ToastmasterCornerMeeting | null;
  clubInfo: ToastmasterCornerClubInfo | null;
  toastmasterOfDay: ToastmasterOfDayRow | null;
  toastmasterMeetingData: ToastmasterMeetingDataRow | null;
  isExComm: boolean;
  isVPEClub: boolean;
};

const CACHE_TTL_MS = 90_000;
const PERSIST_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_PREFIX = 'toastmasterCorner:v1:';
let bundleCache:
  | { key: string; at: number; data: ToastmasterCornerBundle }
  | null = null;

export const toastmasterCornerQueryKeys = {
  all: ['toastmaster-corner'] as const,
  detail: (meetingId: string, clubId: string, userId: string) =>
    [...toastmasterCornerQueryKeys.all, 'detail', meetingId, clubId, userId] as const,
};

function bundleCacheKey(meetingId: string, clubId: string, userId: string) {
  return `${meetingId}:${clubId}:${userId || 'anon'}`;
}

async function readPersisted(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<{ at: number; data: ToastmasterCornerBundle } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${bundleCacheKey(meetingId, clubId, userId)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: ToastmasterCornerBundle };
    if (!parsed?.at || !parsed?.data) return null;
    if (Date.now() - parsed.at > PERSIST_TTL_MS) return null;
    return { at: parsed.at, data: parsed.data };
  } catch {
    return null;
  }
}

async function writePersisted(
  meetingId: string,
  clubId: string,
  userId: string,
  data: ToastmasterCornerBundle
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${bundleCacheKey(meetingId, clubId, userId)}`,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    // ignore cache write failures
  }
}

export async function getCachedToastmasterCornerBundle(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<ToastmasterCornerBundle | null> {
  const key = bundleCacheKey(meetingId, clubId, userId);
  if (bundleCache?.key === key && Date.now() - bundleCache.at < PERSIST_TTL_MS) {
    return bundleCache.data;
  }
  const persisted = await readPersisted(meetingId, clubId, userId);
  if (!persisted) return null;
  bundleCache = { key, at: persisted.at, data: persisted.data };
  return persisted.data;
}

type RpcToastmasterSnapshot = {
  meeting_id: string;
  club_id: string;
  meeting: ToastmasterCornerMeeting | null;
  club: ToastmasterCornerClubInfo | null;
  toastmaster_of_day: ToastmasterOfDayRow | null;
  toastmaster_meeting_data: ToastmasterMeetingDataRow | null;
  is_excomm: boolean;
  is_vpe_for_club: boolean;
};

function mapRpcToBundle(row: RpcToastmasterSnapshot): ToastmasterCornerBundle {
  return {
    meeting: row.meeting,
    clubInfo: row.club,
    toastmasterOfDay: row.toastmaster_of_day,
    toastmasterMeetingData: row.toastmaster_meeting_data,
    isExComm: !!row.is_excomm,
    isVPEClub: !!row.is_vpe_for_club,
  };
}

/**
 * Legacy: six parallel PostgREST reads (same as before snapshot RPC).
 */
async function fetchToastmasterCornerBundleLegacy(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<ToastmasterCornerBundle> {
  const isUserKnown = !!userId;
  const [tmRes, meetingRes, clubRes, roleRes, vpeRes, themeListRes] = await Promise.all([
    supabase
      .from('app_meeting_roles_management')
      .select(
        `
          id,
          role_name,
          assigned_user_id,
          booking_status,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `
      )
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%toastmaster%')
      .eq('role_status', 'Available')
      .eq('booking_status', 'booked')
      .maybeSingle(),
    supabase.from('app_club_meeting').select('*').eq('id', meetingId).single(),
    supabase.from('clubs').select('id, name, club_number, charter_date').eq('id', clubId).single(),
    isUserKnown
      ? supabase.from('app_club_user_relationship').select('role').eq('user_id', userId).eq('club_id', clubId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    isUserKnown
      ? supabase.from('club_profiles').select('vpe_id').eq('club_id', clubId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    supabase.from('toastmaster_meeting_data').select('*').eq('meeting_id', meetingId).eq('club_id', clubId),
  ]);

  if (tmRes.error) {
    console.error('Error loading toastmaster of day:', tmRes.error);
  }

  if (meetingRes.error) {
    console.error('Error loading meeting:', meetingRes.error);
  }

  if (clubRes.error) {
    console.error('Error loading club info:', clubRes.error);
  }

  if (roleRes.error) {
    console.error('Error loading user role:', roleRes.error);
  }

  if (vpeRes.error) {
    console.error('Error loading club VPE:', vpeRes.error);
  }

  if (themeListRes.error) {
    console.error('Error loading toastmaster meeting data:', themeListRes.error);
  }

  const toastmasterOfDay = (tmRes.data ?? null) as ToastmasterOfDayRow | null;
  const meeting = meetingRes.error ? null : (meetingRes.data as ToastmasterCornerMeeting);
  const clubInfo = clubRes.error ? null : (clubRes.data as ToastmasterCornerClubInfo);

  const isExComm = !isUserKnown ? false : (roleRes.error ? false : roleRes.data?.role === 'excomm');
  const isVPEClub = !isUserKnown ? false : (vpeRes.error ? false : vpeRes.data?.vpe_id === userId);

  let toastmasterMeetingData: ToastmasterMeetingDataRow | null = null;
  if (!themeListRes.error) {
    const assignedId = toastmasterOfDay?.assigned_user_id ?? null;
    const rows = (themeListRes.data as ToastmasterMeetingDataRow[] | null) ?? [];
    if (assignedId) {
      toastmasterMeetingData = rows.find((r) => r.toastmaster_user_id === assignedId) ?? null;
    }
  }

  return {
    meeting,
    clubInfo,
    toastmasterOfDay,
    toastmasterMeetingData,
    isExComm,
    isVPEClub,
  };
}

/**
 * One RPC when available; parallel REST fallback (same shape as before).
 */
export async function fetchToastmasterCornerBundle(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<ToastmasterCornerBundle> {
  const key = bundleCacheKey(meetingId, clubId, userId);
  if (bundleCache?.key === key && Date.now() - bundleCache.at < CACHE_TTL_MS) {
    return bundleCache.data;
  }
  const persisted = await readPersisted(meetingId, clubId, userId);
  if (persisted && Date.now() - persisted.at < CACHE_TTL_MS) {
    bundleCache = { key, at: persisted.at, data: persisted.data };
    return persisted.data;
  }

  const { data, error } = await supabase.rpc('get_toastmaster_corner_snapshot', {
    p_meeting_id: meetingId,
  });

  if (!error && data === null) {
    return fetchToastmasterCornerBundleLegacy(meetingId, clubId, userId);
  }

  if (!error && data != null && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as RpcToastmasterSnapshot;
    if (row.club_id === clubId) {
      const mapped = mapRpcToBundle(row);
      bundleCache = { key, at: Date.now(), data: mapped };
      void writePersisted(meetingId, clubId, userId, mapped);
      return mapped;
    }
  }

  if (error) {
    console.warn('get_toastmaster_corner_snapshot failed, using legacy parallel queries:', error.message);
  }

  const legacy = await fetchToastmasterCornerBundleLegacy(meetingId, clubId, userId);
  bundleCache = { key, at: Date.now(), data: legacy };
  void writePersisted(meetingId, clubId, userId, legacy);
  return legacy;
}
