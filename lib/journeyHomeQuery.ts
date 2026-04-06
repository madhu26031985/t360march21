import { supabase } from '@/lib/supabase';

export const journeyHomeQueryKeys = {
  all: ['journey-home'] as const,
  snapshot: (clubId: string, userId: string) => [...journeyHomeQueryKeys.all, 'snapshot', clubId, userId] as const,
};

export type JourneyHomeOpenMeeting = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
};

export type JourneyHomeSnapshot = {
  club_id: string;
  open_meeting: JourneyHomeOpenMeeting | null;
  /** Meetings with `meeting_status = 'open'` for this club (VPE My Tasks planning nudge). */
  open_meetings_count: number;
  journey_stats: {
    meeting_attended_count: number;
    roles_completed_count: number;
    speeches_given_count: number;
    evaluations_given_count: number;
  };
  is_vpe_for_club: boolean;
  has_active_poll: boolean;
  has_voted_in_active_poll: boolean;
};

function pickOpenMeeting(
  rows: Array<{
    id: string;
    meeting_title: string;
    meeting_date: string;
    meeting_start_time: string | null;
    meeting_end_time: string | null;
    meeting_mode: string;
  }> | null
): JourneyHomeOpenMeeting | null {
  const now = new Date();
  const openMeetingsWithinWindow = (rows || []).filter((meeting) => {
    const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
    const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceMeetingEnd < 4;
  });
  const active = openMeetingsWithinWindow[0];
  return active ?? null;
}

async function fetchJourneyHomeLegacy(clubId: string, userId: string): Promise<JourneyHomeSnapshot> {
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

  const [rolesRes, vpeRes, meetingsRes, openMeetingsCountRes, pollsRes] = await Promise.all([
    supabase
      .from('app_meeting_roles_management')
      .select('meeting_id, role_classification, role_name')
      .eq('club_id', clubId)
      .eq('assigned_user_id', userId)
      .eq('booking_status', 'booked'),
    supabase.from('club_profiles').select('vpe_id').eq('club_id', clubId).maybeSingle(),
    supabase
      .from('app_club_meeting')
      .select('id, meeting_title, meeting_date, meeting_start_time, meeting_end_time, meeting_mode')
      .eq('club_id', clubId)
      .eq('meeting_status', 'open')
      .gte('meeting_date', cutoffDate)
      .order('meeting_date', { ascending: true })
      .limit(5),
    supabase
      .from('app_club_meeting')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('meeting_status', 'open'),
    supabase.from('polls').select('id').eq('club_id', clubId).eq('status', 'published'),
  ]);

  const list = rolesRes.data || [];
  const distinctMeetingIds = new Set(list.map((row: { meeting_id: string }) => row.meeting_id));

  const isPrepared = (r: { role_classification?: string | null; role_name?: string | null }) => {
    const rc = r.role_classification || '';
    const rn = (r.role_name || '').toLowerCase();
    if (rc === 'Prepared Speaker') return true;
    if (rn.includes('prepared') && rn.includes('speaker')) return true;
    if (rn.includes('ice') && rn.includes('breaker')) return true;
    return false;
  };
  const evalClass = new Set(['Speech evaluvator', 'Master evaluvator', 'speech_evaluator']);

  const openMeeting = meetingsRes.error ? null : pickOpenMeeting(meetingsRes.data ?? null);

  let hasActivePoll = false;
  let hasVotedInActivePoll = false;
  if (!pollsRes.error && pollsRes.data && pollsRes.data.length > 0) {
    hasActivePoll = true;
    const pollIds = pollsRes.data.map((p: { id: string }) => p.id);
    const { data: votes, error: votesError } = await supabase
      .from('simple_poll_votes')
      .select('poll_id')
      .eq('user_id', userId)
      .in('poll_id', pollIds)
      .limit(1);
    hasVotedInActivePoll = !votesError && votes && votes.length > 0;
  }

  const openMeetingsCountRaw =
    typeof openMeetingsCountRes.count === 'number' && !openMeetingsCountRes.error
      ? openMeetingsCountRes.count
      : 0;
  /** If count query fails or lags, still match hero `open_meeting` (at least one open). */
  const openMeetingsCount = Math.max(openMeetingsCountRaw, openMeeting ? 1 : 0);

  return {
    club_id: clubId,
    open_meeting: openMeeting,
    open_meetings_count: openMeetingsCount,
    journey_stats: {
      meeting_attended_count: distinctMeetingIds.size,
      roles_completed_count: list.length,
      speeches_given_count: list.filter(isPrepared).length,
      evaluations_given_count: list.filter((r) => evalClass.has(r.role_classification || '')).length,
    },
    is_vpe_for_club: vpeRes.data?.vpe_id === userId,
    has_active_poll: hasActivePoll,
    has_voted_in_active_poll: hasVotedInActivePoll,
  };
}

/**
 * Single RPC when available; parallel REST fallback (same shape).
 */
export async function fetchJourneyHomeSnapshot(clubId: string, userId: string): Promise<JourneyHomeSnapshot | null> {
  const { data, error } = await supabase.rpc('get_journey_home_snapshot', { p_club_id: clubId });

  if (!error && data === null) {
    return null;
  }

  if (!error && data != null && typeof data === 'object' && !Array.isArray(data)) {
    const base = data as JourneyHomeSnapshot;
    const raw = (data as Record<string, unknown>).open_meetings_count;
    const parsed =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))
          ? Number(raw)
          : 0;
    const n = Number.isFinite(parsed) ? parsed : 0;
    return {
      ...base,
      open_meetings_count: Math.max(n, base.open_meeting ? 1 : 0),
    };
  }

  if (error) {
    console.warn('get_journey_home_snapshot failed, using legacy queries:', error.message);
  }

  return fetchJourneyHomeLegacy(clubId, userId);
}
