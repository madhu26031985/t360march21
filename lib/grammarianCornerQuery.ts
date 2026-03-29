import { supabase } from '@/lib/supabase';

export type GrammarianCornerMeeting = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
  [key: string]: unknown;
};

export type GrammarianAssignedProfile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type GrammarianCornerSnapshot = {
  meeting_id: string;
  club_id: string;
  meeting: GrammarianCornerMeeting;
  club_name: string | null;
  assigned_grammarian: GrammarianAssignedProfile | null;
  is_vpe_for_club: boolean;
};

export async function fetchGrammarianClubMembersDirectory(clubId: string): Promise<
  Array<{ id: string; full_name: string; email: string; avatar_url: string | null }>
> {
  const { data, error } = await supabase.rpc('get_club_member_directory', { target_club_id: clubId });
  if (error) {
    console.error('get_club_member_directory:', error);
    return [];
  }
  const rows = (data || []) as Array<{ user_id: string; full_name: string; email: string; avatar_url: string | null }>;
  const members = rows.map((r) => ({
    id: r.user_id,
    full_name: r.full_name,
    email: r.email,
    avatar_url: r.avatar_url,
  }));
  members.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return members;
}

/**
 * One RPC when available; parallel REST fallback (same shape as before snapshot).
 */
export async function fetchGrammarianCornerSnapshot(
  meetingId: string,
  userId: string,
  clubId: string
): Promise<GrammarianCornerSnapshot | null> {
  const { data, error } = await supabase.rpc('get_grammarian_corner_snapshot', {
    p_meeting_id: meetingId,
  });

  if (!error && data === null) {
    return null;
  }

  if (!error && data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as GrammarianCornerSnapshot;
  }

  if (error) {
    console.warn('get_grammarian_corner_snapshot failed, using legacy queries:', error.message);
  }

  const [{ data: meetingData, error: meetingErr }, clubRes, vpeRes, roleRowRes] = await Promise.all([
    supabase.from('app_club_meeting').select('*').eq('id', meetingId).single(),
    supabase.from('clubs').select('name').eq('id', clubId).single(),
    supabase.from('club_profiles').select('vpe_id').eq('club_id', clubId).maybeSingle(),
    supabase
      .from('app_meeting_roles_management')
      .select('assigned_user_id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%grammarian%')
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .maybeSingle(),
  ]);

  if (meetingErr || !meetingData) {
    return null;
  }

  let assigned: GrammarianAssignedProfile | null = null;
  const assigneeId = (roleRowRes.data as { assigned_user_id?: string } | null)?.assigned_user_id;
  if (assigneeId) {
    const { data: prof } = await supabase
      .from('app_user_profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', assigneeId)
      .maybeSingle();
    if (prof) {
      assigned = {
        id: prof.id,
        full_name: prof.full_name,
        email: prof.email,
        avatar_url: prof.avatar_url,
      };
    }
  }

  return {
    meeting_id: meetingId,
    club_id: clubId,
    meeting: meetingData as GrammarianCornerMeeting,
    club_name: clubRes.data?.name ?? null,
    assigned_grammarian: assigned,
    is_vpe_for_club: vpeRes.data?.vpe_id === userId,
  };
}
