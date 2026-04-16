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

/** Coalesce concurrent RPCs and short-TTL cache so prefetch + screen share one download. */
const inflight = new Map<string, Promise<MeetingAgendaSnapshot | null>>();
const recent = new Map<string, { value: MeetingAgendaSnapshot | null; at: number }>();
const RECENT_MS = 15_000;

export function getCachedMeetingAgendaSnapshot(meetingId: string): MeetingAgendaSnapshot | null {
  const hit = recent.get(meetingId);
  if (!hit) return null;
  if (Date.now() - hit.at >= RECENT_MS) return null;
  return hit.value;
}

/** Drop memoized snapshot (in-flight RPC continues; next fetch may still await it). */
export function invalidateMeetingAgendaSnapshot(meetingId: string | null | undefined): void {
  if (!meetingId) return;
  recent.delete(meetingId);
}

export async function fetchMeetingAgendaSnapshot(
  meetingId: string,
  options?: { bypassCache?: boolean }
): Promise<MeetingAgendaSnapshot | null> {
  if (options?.bypassCache) {
    recent.delete(meetingId);
    const stalled = inflight.get(meetingId);
    if (stalled) {
      try {
        await stalled;
      } catch {
        /* ignore */
      }
      if (inflight.get(meetingId) === stalled) {
        inflight.delete(meetingId);
      }
      recent.delete(meetingId);
    }
  }

  const now = Date.now();
  const hit = recent.get(meetingId);
  if (hit && now - hit.at < RECENT_MS) {
    return hit.value;
  }

  let pending = inflight.get(meetingId);
  if (!pending) {
    const p = (async (): Promise<MeetingAgendaSnapshot | null> => {
      try {
        const { data, error } = await (supabase as any).rpc('get_meeting_agenda_snapshot', {
          p_meeting_id: meetingId,
        });
        if (error || data == null || typeof data !== 'object') {
          return null;
        }
        const parsed = data as MeetingAgendaSnapshot;
        recent.set(meetingId, { value: parsed, at: Date.now() });
        return parsed;
      } finally {
        if (inflight.get(meetingId) === p) {
          inflight.delete(meetingId);
        }
      }
    })();
    pending = p;
    inflight.set(meetingId, p);
  }
  return pending;
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
