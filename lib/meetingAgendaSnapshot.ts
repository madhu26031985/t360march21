import { supabase } from '@/lib/supabase';

export type MeetingAgendaSnapshotVpmVpe = {
  full_name: string;
  phone_number: string | null;
} | null;

export type MeetingAgendaSnapshotEvaluationRow = {
  id: string;
  evaluation_pathway_id: string;
  evaluation_pdf_url: string | null;
};

/** One RPC payload for Meeting Agenda (replaces many parallel PostgREST calls). */
export type MeetingAgendaSnapshot = {
  meeting: Record<string, unknown>;
  club: Record<string, unknown> | null;
  vpm: MeetingAgendaSnapshotVpmVpe;
  vpe: MeetingAgendaSnapshotVpmVpe;
  agenda_items: unknown[];
  pathways: unknown[];
  grammarian_word_of_the_day: Record<string, unknown> | null;
  grammarian_idiom_of_the_day: Record<string, unknown> | null;
  grammarian_quote_of_the_day: Record<string, unknown> | null;
  booked_prepared_roles: { assigned_user_id: string; booking_status: string }[];
  profiles: Record<string, { id: string; full_name: string; avatar_url: string | null }>;
  evaluations: MeetingAgendaSnapshotEvaluationRow[];
};

export async function fetchMeetingAgendaSnapshot(meetingId: string): Promise<MeetingAgendaSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_meeting_agenda_snapshot', {
    p_meeting_id: meetingId,
  });
  if (error || data == null || typeof data !== 'object') {
    return null;
  }
  return data as MeetingAgendaSnapshot;
}

export function evaluationsArrayToRecord(
  rows: MeetingAgendaSnapshotEvaluationRow[] | null | undefined
): Record<string, MeetingAgendaSnapshotEvaluationRow> {
  const out: Record<string, MeetingAgendaSnapshotEvaluationRow> = {};
  for (const ev of rows || []) {
    out[ev.evaluation_pathway_id] = ev;
  }
  return out;
}
