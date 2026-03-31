import { supabase } from '@/lib/supabase';

export const vpeNudgesQueryKeys = {
  snapshot: (clubId: string, userId: string) =>
    ['vpe-nudges-snapshot', clubId, userId] as const,
};

export type VpeNudgesSnapshot = {
  allowed: boolean;
  club_name: string | null;
  meeting: {
    id: string;
    meeting_title: string | null;
    meeting_date: string;
    meeting_number: string | number | null;
    meeting_start_time: string | null;
  } | null;
  roles: {
    role_name: string;
    role_metric: string | null;
    role_classification: string | null;
    booking_status: string | null;
    assigned_user_id: string | null;
  }[];
  prepared_roles: {
    role_name: string;
    assigned_user_id: string;
  }[];
  pathways: {
    user_id: string;
    role_name: string;
    speech_title: string | null;
    pathway_name: string | null;
    level: string | null;
    project_name: string | null;
    evaluation_form: string | null;
    comments_for_evaluator: string | null;
    assigned_evaluator_id: string | null;
  }[];
  toastmaster_data: {
    toastmaster_user_id: string;
    theme_of_the_day: string | null;
  }[];
  educational_content: { speech_title: string | null } | null;
  keynote_content: { speech_title: string | null } | null;
  profiles: { id: string; full_name: string | null }[];
};

export async function fetchVpeNudgesSnapshot(
  clubId: string
): Promise<VpeNudgesSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_vpe_nudges_snapshot', {
    p_club_id: clubId,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;
  return {
    allowed: Boolean(raw.allowed),
    club_name: (raw.club_name as string | null) ?? null,
    meeting: (raw.meeting as VpeNudgesSnapshot['meeting']) ?? null,
    roles: Array.isArray(raw.roles) ? (raw.roles as VpeNudgesSnapshot['roles']) : [],
    prepared_roles: Array.isArray(raw.prepared_roles)
      ? (raw.prepared_roles as VpeNudgesSnapshot['prepared_roles'])
      : [],
    pathways: Array.isArray(raw.pathways) ? (raw.pathways as VpeNudgesSnapshot['pathways']) : [],
    toastmaster_data: Array.isArray(raw.toastmaster_data)
      ? (raw.toastmaster_data as VpeNudgesSnapshot['toastmaster_data'])
      : [],
    educational_content:
      (raw.educational_content as VpeNudgesSnapshot['educational_content']) ?? null,
    keynote_content: (raw.keynote_content as VpeNudgesSnapshot['keynote_content']) ?? null,
    profiles: Array.isArray(raw.profiles) ? (raw.profiles as VpeNudgesSnapshot['profiles']) : [],
  };
}
