import { supabase } from '@/lib/supabase';

const CACHE_TTL_MS = 2 * 60 * 1000;

export type PathwayFormSnapshot = {
  meeting: any | null;
  roleBooking: any | null;
  pathway: any | null;
};

const cache = new Map<string, { at: number; data: PathwayFormSnapshot }>();

export function getCachedPathwayFormSnapshot(roleId: string): PathwayFormSnapshot | null {
  const hit = cache.get(roleId);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(roleId);
    return null;
  }
  return hit.data;
}

export async function prefetchPathwayFormSnapshot(
  meetingId: string | null | undefined,
  roleId: string | null | undefined
): Promise<PathwayFormSnapshot | null> {
  if (!meetingId || !roleId) return null;

  const cached = getCachedPathwayFormSnapshot(roleId);
  if (cached) return cached;

  const { data: roleData, error: roleErr } = await supabase
    .from('app_meeting_roles_management')
    .select(
      `
      id,
      assigned_user_id,
      role_name,
      role_metric,
      booking_status,
      role_classification,
      speech_title,
      pathway_name,
      level,
      project_name,
      project_number,
      evaluation_form,
      comments_for_evaluator,
      app_user_profiles (
        id,
        full_name,
        email,
        avatar_url
      )
    `
    )
    .eq('id', roleId)
    .maybeSingle();

  if (roleErr || !roleData) return null;

  const roleBooking = {
    id: roleData.id,
    user_id: roleData.assigned_user_id!,
    role_name: roleData.role_name,
    role_metric: roleData.role_metric,
    booking_status: roleData.booking_status,
    role_classification: roleData.role_classification,
    app_user_profiles: (roleData as any).app_user_profiles,
    speech_title: (roleData as any).speech_title ?? null,
    pathway_name: (roleData as any).pathway_name ?? null,
    level: (roleData as any).level ?? null,
    project_name: (roleData as any).project_name ?? null,
    project_number: (roleData as any).project_number ?? null,
    evaluation_form: (roleData as any).evaluation_form ?? null,
    comments_for_evaluator: (roleData as any).comments_for_evaluator ?? null,
  };

  const [meetingRes, pathwayRes] = await Promise.all([
    supabase
      .from('app_club_meeting')
      .select('*')
      .eq('id', meetingId)
      .maybeSingle(),
    supabase
      .from('app_evaluation_pathway')
      .select(
        `
        id,
        meeting_id,
        club_id,
        user_id,
        role_name,
        speech_title,
        pathway_name,
        level,
        project_name,
        project_number,
        evaluation_form,
        comments_for_evaluator,
        evaluation_title,
        table_topics_title,
        assigned_evaluator_id,
        created_at,
        updated_at,
        updated_by,
        vpe_approval_requested,
        vpe_approval_requested_at
      `
      )
      .eq('meeting_id', meetingId)
      .eq('user_id', roleBooking.user_id)
      .eq('role_name', roleBooking.role_name)
      .maybeSingle(),
  ]);

  const data: PathwayFormSnapshot = {
    meeting: meetingRes.error ? null : meetingRes.data ?? null,
    roleBooking,
    pathway: pathwayRes.error ? null : pathwayRes.data ?? null,
  };
  cache.set(roleId, { at: Date.now(), data });
  return data;
}

