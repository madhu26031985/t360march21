import { supabase } from '@/lib/supabase';
import { type MeetingVisitingGuest, parseMeetingVisitingGuests } from '@/lib/meetingVisitingGuests';

export const ahCounterQueryKeys = {
  snapshot: (meetingId: string, clubId: string, userId: string) =>
    ['ah-counter-snapshot', meetingId, clubId, userId] as const,
};

export type AhCounterSnapshot = {
  meeting: Record<string, unknown> | null;
  club_id: string;
  assigned_ah_counter: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  report_stats: {
    total_speakers: number;
    completed_reports: number;
    selected_members: number;
  };
  is_excomm: boolean;
  is_vpe_for_club: boolean;
  // Heavy arrays intentionally excluded from the snapshot for performance.
  // Fetch via `get_ah_counter_audit_members` / `get_ah_counter_report_rows` RPCs.
  report_rows: Record<string, unknown>[];
  audit_members: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
  }[];
  published_count: number;
  total_reports: number;
  /** Up to 5 visiting guest names for this meeting (Timer / Ah Counter / Grammarian). */
  visiting_guests: MeetingVisitingGuest[];
};

export async function fetchAhCounterSnapshot(
  meetingId: string
): Promise<AhCounterSnapshot | null> {
  // Prefer the small snapshot RPC for <1s initial load.
  // Fall back to the legacy/heavy snapshot if the small RPC is not deployed yet.
  const trySmall = await (supabase as any).rpc('get_ah_counter_corner_snapshot_small', {
    p_meeting_id: meetingId,
  });
  const tryLegacy =
    trySmall.error
      ? await (supabase as any).rpc('get_ah_counter_corner_snapshot', { p_meeting_id: meetingId })
      : null;

  const data = (trySmall.error ? tryLegacy?.data : trySmall.data) as unknown;
  const error = (trySmall.error ? tryLegacy?.error : trySmall.error) as any;

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  return {
    meeting: (raw.meeting as Record<string, unknown> | null) ?? null,
    club_id: String(raw.club_id || ''),
    assigned_ah_counter:
      (raw.assigned_ah_counter as AhCounterSnapshot['assigned_ah_counter']) ?? null,
    report_stats: {
      total_speakers: Number((raw.report_stats as any)?.total_speakers || 0),
      completed_reports: Number((raw.report_stats as any)?.completed_reports || 0),
      selected_members: Number((raw.report_stats as any)?.selected_members || 0),
    },
    is_excomm: Boolean(raw.is_excomm),
    is_vpe_for_club: Boolean(raw.is_vpe_for_club),
    // Backward-compatible fields; new RPC returns [] for these.
    report_rows: Array.isArray(raw.report_rows) ? (raw.report_rows as Record<string, unknown>[]) : [],
    audit_members: Array.isArray(raw.audit_members)
      ? (raw.audit_members as AhCounterSnapshot['audit_members'])
      : [],
    published_count: Number(raw.published_count || 0),
    total_reports: Number(raw.total_reports || 0),
    visiting_guests: parseMeetingVisitingGuests(raw.visiting_guests),
  };
}
