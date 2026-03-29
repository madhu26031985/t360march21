import { supabase } from '@/lib/supabase';

export const excommManagementQueryKeys = {
  all: ['excomm-management'] as const,
  snapshot: (clubId: string) => [...excommManagementQueryKeys.all, 'snapshot', clubId] as const,
};

export type ExcommManagementBundle = {
  club: { id: string; name: string; club_number: string | null } | null;
  excomm: Record<string, unknown> | null;
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    phone_number: string | null;
    role: string;
  }>;
};

const CLUB_PROFILES_EXCOMM_SELECT = `
  president_id, president_term_start, president_term_end,
  ipp_id, ipp_term_start, ipp_term_end,
  vpe_id, vpe_term_start, vpe_term_end,
  vpm_id, vpm_term_start, vpm_term_end,
  vppr_id, vppr_term_start, vppr_term_end,
  secretary_id, secretary_term_start, secretary_term_end,
  treasurer_id, treasurer_term_start, treasurer_term_end,
  saa_id, saa_term_start, saa_term_end,
  area_director_id, area_director_term_start, area_director_term_end,
  division_director_id, division_director_term_start, division_director_term_end,
  district_director_id, district_director_term_start, district_director_term_end,
  program_quality_director_id, program_quality_director_term_start, program_quality_director_term_end,
  club_growth_director_id, club_growth_director_term_start, club_growth_director_term_end,
  immediate_past_district_director_id, immediate_past_district_director_term_start, immediate_past_district_director_term_end
`;

/**
 * Single RPC when available; parallel REST fallback (same shape) for older DBs or RPC errors.
 */
export async function fetchExcommManagementBundle(clubId: string): Promise<ExcommManagementBundle> {
  const { data: snapshot, error: snapshotError } = await supabase.rpc('get_excomm_management_snapshot', {
    p_club_id: clubId,
  });

  if (
    !snapshotError &&
    snapshot != null &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot)
  ) {
    const row = snapshot as {
      club: ExcommManagementBundle['club'];
      excomm: Record<string, unknown> | null;
      members: ExcommManagementBundle['members'] | null;
    };
    return {
      club: row.club ?? null,
      excomm: row.excomm ?? null,
      members: row.members ?? [],
    };
  }

  if (snapshotError) {
    console.warn('get_excomm_management_snapshot failed, using separate queries:', snapshotError.message);
  }

  const [clubRes, membersRes, profileRes] = await Promise.all([
    supabase.from('clubs').select('id, name, club_number').eq('id', clubId).single(),
    supabase
      .from('app_club_user_relationship')
      .select(
        `
        app_user_profiles (
          id,
          full_name,
          email,
          avatar_url,
          phone_number
        ),
        role
      `
      )
      .eq('club_id', clubId)
      .eq('is_authenticated', true),
    supabase.from('club_profiles').select(CLUB_PROFILES_EXCOMM_SELECT).eq('club_id', clubId).single(),
  ]);

  if (clubRes.error) {
    throw new Error(clubRes.error.message);
  }

  const members: ExcommManagementBundle['members'] = (membersRes.data || []).map((item) => ({
    id: (item as any).app_user_profiles.id,
    full_name: (item as any).app_user_profiles.full_name,
    email: (item as any).app_user_profiles.email,
    avatar_url: (item as any).app_user_profiles.avatar_url ?? null,
    phone_number: (item as any).app_user_profiles.phone_number ?? null,
    role: (item as any).role,
  }));

  if (membersRes.error) {
    console.error('Error loading club members:', membersRes.error);
  }

  let excomm: Record<string, unknown> | null = null;
  if (profileRes.error && profileRes.error.code !== 'PGRST116') {
    console.error('Error loading excomm roles:', profileRes.error);
  } else {
    excomm = (profileRes.data as Record<string, unknown>) || null;
  }

  return {
    club: clubRes.data ?? null,
    excomm,
    members,
  };
}
