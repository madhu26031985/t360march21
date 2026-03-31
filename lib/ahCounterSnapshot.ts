import { supabase } from '@/lib/supabase';

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
  report_rows: Record<string, unknown>[];
  audit_members: {
    user_id: string;
    full_name: string;
    avatar_url: string | null;
  }[];
  published_count: number;
  total_reports: number;
};

export async function fetchAhCounterSnapshot(
  meetingId: string
): Promise<AhCounterSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_ah_counter_corner_snapshot', {
    p_meeting_id: meetingId,
  });
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
    report_rows: Array.isArray(raw.report_rows) ? (raw.report_rows as Record<string, unknown>[]) : [],
    audit_members: Array.isArray(raw.audit_members)
      ? (raw.audit_members as AhCounterSnapshot['audit_members'])
      : [],
    published_count: Number(raw.published_count || 0),
    total_reports: Number(raw.total_reports || 0),
  };
}
