import { supabase } from '@/lib/supabase';

export const educationalCornerQueryKeys = {
  all: ['educational-corner'] as const,
  snapshot: (meetingId: string, userId: string) =>
    [...educationalCornerQueryKeys.all, 'snapshot', meetingId, userId] as const,
};

/** Snapshot row shape from get_educational_corner_snapshot (JSON keys). */
export type EducationalCornerSnapshotRow = {
  meeting_id: string;
  club_id: string;
  club_name: string | null;
  meeting: Record<string, unknown> | null;
  educational_role: {
    id: string;
    role_name: string;
    assigned_user_id: string | null;
    booking_status: string;
    role_status: string;
    role_classification: string | null;
    app_user_profiles: {
      full_name: string;
      email: string;
      avatar_url: string | null;
    } | null;
  } | null;
  educational_content: {
    speech_title: string | null;
    notes: string | null;
  } | null;
  is_excomm: boolean;
  is_vpe_club: boolean;
};

export type EducationalCornerSpeaker = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  speech_title: string | null;
  summary: string | null;
  notes: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
};

export type EducationalCornerMeeting = {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
  club_name?: string;
};

export type EducationalCornerBundle = {
  meeting: EducationalCornerMeeting;
  educationalSpeaker: EducationalCornerSpeaker | null;
  isExComm: boolean;
  isVPEClub: boolean;
};

function mapSnapshotToBundle(row: EducationalCornerSnapshotRow): EducationalCornerBundle {
  const mt = row.meeting as Record<string, unknown> | null;
  if (!mt || typeof mt.id !== 'string') {
    throw new Error('Invalid meeting payload from get_educational_corner_snapshot');
  }

  const meeting: EducationalCornerMeeting = {
    ...(mt as unknown as EducationalCornerMeeting),
    club_name: row.club_name ?? undefined,
  };

  let educationalSpeaker: EducationalCornerSpeaker | null = null;
  const role = row.educational_role;
  if (role) {
    educationalSpeaker = {
      id: role.id,
      role_name: role.role_name,
      assigned_user_id: role.assigned_user_id,
      booking_status: role.booking_status,
      app_user_profiles: role.app_user_profiles ?? undefined,
      speech_title: null,
      summary: null,
      notes: null,
    };
    const ec = row.educational_content;
    if (ec) {
      educationalSpeaker.speech_title = ec.speech_title;
      educationalSpeaker.summary = null;
      educationalSpeaker.notes = ec.notes;
    }
  }

  return {
    meeting,
    educationalSpeaker,
    isExComm: Boolean(row.is_excomm),
    isVPEClub: Boolean(row.is_vpe_club),
  };
}

async function fetchEducationalCornerLegacy(
  meetingId: string,
  userId: string,
  clubId: string
): Promise<EducationalCornerBundle | null> {
  const isUserKnown = !!userId;
  const [{ data: meetingData, error: meetingError }, membershipRes, vpeRes] = await Promise.all([
    supabase
      .from('app_club_meeting')
      .select(`*, clubs!inner(name)`)
      .eq('id', meetingId)
      .single(),
    isUserKnown
      ? supabase
          .from('app_club_user_relationship')
          .select('role')
          .eq('user_id', userId)
          .eq('club_id', clubId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    isUserKnown
      ? supabase.from('club_profiles').select('vpe_id').eq('club_id', clubId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  if (meetingError || !meetingData) {
    console.error('Educational corner legacy: meeting', meetingError);
    return null;
  }

  const isExComm = !isUserKnown ? false : membershipRes.data?.role === 'excomm';
  const isVPEClub = !isUserKnown ? false : vpeRes.data?.vpe_id === userId;

  const meeting: EducationalCornerMeeting = {
    ...(meetingData as unknown as EducationalCornerMeeting),
    club_name: (meetingData as { clubs?: { name?: string } }).clubs?.name,
  };

  const { data: roleAssignment, error: roleError } = await supabase
    .from('app_meeting_roles_management')
    .select(
      `
      id,
      role_name,
      assigned_user_id,
      booking_status,
      role_status,
      role_classification,
      app_user_profiles (
        full_name,
        email,
        avatar_url
      )
    `
    )
    .eq('meeting_id', meetingId)
    .eq('role_name', 'Educational Speaker')
    .eq('role_status', 'Available')
    .eq('booking_status', 'booked')
    .maybeSingle();

  if (roleError && roleError.code !== 'PGRST116') {
    console.error('Educational corner legacy: role', roleError);
  }

  let educationalSpeaker: EducationalCornerSpeaker | null = null;
  if (roleAssignment) {
    educationalSpeaker = {
      id: roleAssignment.id,
      role_name: roleAssignment.role_name,
      assigned_user_id: roleAssignment.assigned_user_id,
      booking_status: roleAssignment.booking_status,
      app_user_profiles: roleAssignment.app_user_profiles as EducationalCornerSpeaker['app_user_profiles'],
      speech_title: null,
      summary: null,
      notes: null,
    };
    if (roleAssignment.assigned_user_id) {
      const { data: educationalContent, error: contentError } = await supabase
        .from('app_meeting_educational_speaker')
        .select('speech_title, notes')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', roleAssignment.assigned_user_id)
        .maybeSingle();
      if (contentError && contentError.code !== 'PGRST116') {
        console.error('Educational corner legacy: content', contentError);
      }
      if (educationalContent) {
        educationalSpeaker.speech_title = educationalContent.speech_title;
        educationalSpeaker.summary = null;
        educationalSpeaker.notes = educationalContent.notes;
      }
    }
  }

  return {
    meeting,
    educationalSpeaker,
    isExComm,
    isVPEClub,
  };
}

/**
 * One RPC when available; legacy REST path without the full club roster (roster loads only when Assign opens).
 */
export async function fetchEducationalCornerBundle(
  meetingId: string,
  userId: string,
  clubId: string
): Promise<EducationalCornerBundle | null> {
  const { data, error } = await supabase.rpc('get_educational_corner_snapshot', {
    p_meeting_id: meetingId,
  });

  if (!error && data === null) {
    return null;
  }

  if (!error && data != null && typeof data === 'object' && !Array.isArray(data)) {
    try {
      return mapSnapshotToBundle(data as EducationalCornerSnapshotRow);
    } catch (e) {
      console.warn('get_educational_corner_snapshot map failed:', e);
    }
  }

  if (error) {
    console.warn('get_educational_corner_snapshot failed, using legacy queries:', error.message);
  }

  return fetchEducationalCornerLegacy(meetingId, userId, clubId);
}

export type EducationalCornerClubMember = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

/** Full club roster for Assign Educational Speaker — call only when the modal opens. */
export async function fetchClubMembersForEducationalAssign(clubId: string): Promise<EducationalCornerClubMember[]> {
  const { data, error } = await supabase
    .from('app_club_user_relationship')
    .select(
      `
      app_user_profiles (
        id,
        full_name,
        email,
        avatar_url
      )
    `
    )
    .eq('club_id', clubId)
    .eq('is_authenticated', true);

  if (error) {
    console.error('fetchClubMembersForEducationalAssign:', error);
    return [];
  }

  const members = (data || []).map((item: { app_user_profiles: { id: string; full_name: string; email: string; avatar_url: string | null } }) => ({
    id: item.app_user_profiles.id,
    full_name: item.app_user_profiles.full_name,
    email: item.app_user_profiles.email,
    avatar_url: item.app_user_profiles.avatar_url,
  }));
  members.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return members;
}
