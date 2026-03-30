import { supabase } from '@/lib/supabase';

export type PublicAgendaMeeting = {
  id: string;
  club_id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string | null;
  meeting_location: string | null;
  meeting_link: string | null;
  club_info_banner_color?: string | null;
  datetime_banner_color?: string | null;
};

export type PublicAgendaClub = {
  club_name: string;
  club_number: string | null;
};

export type PublicAgendaItemRow = {
  section_name: string;
  section_description: string | null;
  section_icon: string | null;
  section_order: number;
  duration_minutes: number | null;
  assigned_user_name: string | null;
  timer_user_name: string | null;
  ah_counter_user_name: string | null;
  grammarian_user_name: string | null;
  role_details: Record<string, unknown> | null;
  prepared_speeches_agenda: unknown;
  educational_topic: string | null;
  custom_notes: string | null;
};

export type PublicAgendaPayload = {
  meeting: PublicAgendaMeeting;
  club: PublicAgendaClub;
  items: PublicAgendaItemRow[];
};

export async function fetchPublicMeetingAgenda(params: {
  meetingId: string;
  clubSlug: string;
  meetingNo: string;
}): Promise<PublicAgendaPayload | null> {
  const { data, error } = await supabase.rpc('get_public_meeting_agenda', {
    p_meeting_id: params.meetingId,
    p_club_slug: params.clubSlug,
    p_meeting_no: params.meetingNo,
  });
  if (error) throw error;
  if (data == null || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const meeting = o.meeting as PublicAgendaMeeting | undefined;
  const club = o.club as PublicAgendaClub | undefined;
  const items = o.items as PublicAgendaItemRow[] | undefined;
  if (!meeting?.id || !club?.club_name || !Array.isArray(items)) return null;
  return { meeting, club, items };
}
