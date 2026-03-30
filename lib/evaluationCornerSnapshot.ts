import { supabase } from '@/lib/supabase';

type MeetingSnapshot = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
  meeting_day: string | null;
};

type SnapshotRole = {
  id: string;
  assigned_user_id: string | null;
  role_name: string;
  role_metric: string;
  booking_status: string;
  role_classification: string | null;
  role_status?: string | null;
  app_user_profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

type SnapshotPathway = Record<string, unknown> & {
  user_id: string;
  role_name: string;
};

export type EvaluationCornerSnapshot = {
  meeting?: MeetingSnapshot | null;
  roles?: SnapshotRole[];
  pathways?: SnapshotPathway[];
};

const CACHE_TTL_MS = 60_000;
const snapshotCache = new Map<string, { expiresAt: number; value: EvaluationCornerSnapshot }>();

export function getCachedEvaluationCornerSnapshot(meetingId: string): EvaluationCornerSnapshot | null {
  const hit = snapshotCache.get(meetingId);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    snapshotCache.delete(meetingId);
    return null;
  }
  return hit.value;
}

function setCachedEvaluationCornerSnapshot(meetingId: string, value: EvaluationCornerSnapshot) {
  snapshotCache.set(meetingId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function fetchEvaluationCornerSnapshot(meetingId: string): Promise<EvaluationCornerSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_evaluation_corner_snapshot', {
    p_meeting_id: meetingId,
  });
  if (error || !data || typeof data !== 'object') return null;
  const parsed = data as EvaluationCornerSnapshot;
  setCachedEvaluationCornerSnapshot(meetingId, parsed);
  return parsed;
}

export function prefetchEvaluationCornerSnapshot(meetingId: string | null | undefined): void {
  if (!meetingId) return;
  void fetchEvaluationCornerSnapshot(meetingId);
}
