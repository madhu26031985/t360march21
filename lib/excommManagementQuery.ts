import { supabase } from '@/lib/supabase';

export const excommManagementQueryKeys = {
  all: ['excomm-management'] as const,
  snapshot: (clubId: string) => [...excommManagementQueryKeys.all, 'snapshot', clubId] as const,
};

export type ExcommManagementBundle = {
  club: { id: string; name: string; club_number: string | null } | null;
  excomm: Record<string, unknown> | null;
  /** RPC returns slim rows; legacy fetch may include avatar_url / phone_number. */
  members: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string | null;
    phone_number?: string | null;
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
  saa_id, saa_term_start, saa_term_end
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
    const members = (row.members ?? []).map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email,
      role: m.role,
      avatar_url: m.avatar_url ?? null,
      phone_number: m.phone_number ?? null,
    }));
    return {
      club: row.club ?? null,
      excomm: row.excomm ?? null,
      members,
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
