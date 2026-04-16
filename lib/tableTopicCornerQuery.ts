import { supabase } from '@/lib/supabase';

export type TableTopicMeeting = {
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
};

export type TableTopicUserProfile = {
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type TableTopicMasterRow = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  app_user_profiles?: TableTopicUserProfile | null;
};

export type TableTopicParticipantRow = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  order_index: number;
  app_user_profiles?: TableTopicUserProfile | null;
};

export type TableTopicAssignedQuestionRow = {
  id: string;
  meeting_id: string;
  participant_id: string;
  participant_name: string;
  question_text: string;
  asked_by: string;
  asked_by_name: string;
  created_at: string;
  updated_at: string;
  participant_avatar?: string | null;
};

export type TableTopicClubInfo = {
  name: string;
  club_number: string | null;
  banner_color: string | null;
};

export type TableTopicCornerBundle = {
  meeting: TableTopicMeeting | null;
  clubInfo: TableTopicClubInfo | null;
  isVpe: boolean;
  summaryVisibleToMembers: boolean;
  tableTopicMaster: TableTopicMasterRow | null;
  participants: TableTopicParticipantRow[];
  assignedQuestions: TableTopicAssignedQuestionRow[];
  publishedQuestions: TableTopicAssignedQuestionRow[];
};

export const tableTopicCornerQueryKeys = {
  snapshot: (meetingId: string, clubId: string, userId: string) =>
    ['table-topic-corner-snapshot', meetingId, clubId, userId] as const,
};

type RpcSnapshot = {
  club_id: string;
  is_vpe?: boolean;
  summary_visible_to_members?: boolean | null;
  meeting: TableTopicMeeting | null;
  club_info: TableTopicClubInfo | null;
  table_topic_master: TableTopicMasterRow | null;
  participants: TableTopicParticipantRow[] | null;
  assigned_questions: TableTopicAssignedQuestionRow[] | null;
  published_questions: TableTopicAssignedQuestionRow[] | null;
};

async function fetchTableTopicCornerBundleLegacy(
  meetingId: string,
  clubId: string
): Promise<TableTopicCornerBundle> {
  const [meetingRes, clubRes, profileRes, masterRes, participantsRes, assignedRes, publishedRes] = await Promise.all([
    supabase.from('app_club_meeting').select('*').eq('id', meetingId).maybeSingle(),
    supabase.from('clubs').select('name, club_number').eq('id', clubId).maybeSingle(),
    supabase.from('club_profiles').select('banner_color').eq('club_id', clubId).maybeSingle(),
    supabase
      .from('app_meeting_roles_management')
      .select(
        `
          id,
          role_name,
          assigned_user_id,
          booking_status,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `
      )
      .eq('meeting_id', meetingId)
      .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%')
      .eq('role_status', 'Available')
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .maybeSingle(),
    supabase
      .from('app_meeting_roles_management')
      .select(
        `
          id,
          role_name,
          assigned_user_id,
          booking_status,
          order_index,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `
      )
      .eq('meeting_id', meetingId)
      .or(
        'role_name.ilike.%Table Topics Speaker%,role_name.ilike.%Table Topic Speaker%,role_name.ilike.%Table Topics Participant%,role_name.ilike.%Table Topic Participant%'
      )
      .eq('role_status', 'Available')
      .order('order_index', { ascending: true }),
    supabase
      .from('app_meeting_tabletopicscorner')
      .select('participant_id, question_text')
      .eq('meeting_id', meetingId)
      .eq('booking_status', 'booked')
      .eq('is_active', true),
    supabase
      .from('app_meeting_tabletopicscorner')
      .select('id')
      .eq('meeting_id', meetingId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('is_published', true)
      .order('created_at', { ascending: true }),
  ]);

  // Only `publishedQuestions.length` is used on this screen, so keep payload minimal.
  const publishedWithAvatars = ((publishedRes.data as Array<{ id: string }> | null) ?? []).map((q) => ({
    id: q.id,
  })) as unknown as TableTopicAssignedQuestionRow[];

  return {
    meeting: (meetingRes.data as TableTopicMeeting | null) ?? null,
    clubInfo: clubRes.data
      ? {
          name: clubRes.data.name,
          club_number: clubRes.data.club_number,
          banner_color: profileRes.data?.banner_color ?? null,
        }
      : null,
    isVpe: false,
    summaryVisibleToMembers: true,
    tableTopicMaster: (masterRes.data as TableTopicMasterRow | null) ?? null,
    participants: ((participantsRes.data as TableTopicParticipantRow[] | null) ?? []).sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    ),
    assignedQuestions: (assignedRes.data as TableTopicAssignedQuestionRow[] | null) ?? [],
    publishedQuestions: publishedWithAvatars,
  };
}

export async function fetchTableTopicCornerBundle(
  meetingId: string,
  clubId: string
): Promise<TableTopicCornerBundle> {
  const { data, error } = await supabase.rpc('get_table_topic_corner_snapshot', {
    p_meeting_id: meetingId,
  });

  if (!error && data === null) {
    return fetchTableTopicCornerBundleLegacy(meetingId, clubId);
  }

  if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as RpcSnapshot;
    if (String(row.club_id) === String(clubId)) {
      return {
        meeting: row.meeting ?? null,
        clubInfo: row.club_info ?? null,
        isVpe: Boolean(row.is_vpe),
        summaryVisibleToMembers: row.summary_visible_to_members !== false,
        tableTopicMaster: row.table_topic_master ?? null,
        participants: row.participants ?? [],
        assignedQuestions: row.assigned_questions ?? [],
        publishedQuestions: row.published_questions ?? [],
      };
    }
  }

  return fetchTableTopicCornerBundleLegacy(meetingId, clubId);
}
