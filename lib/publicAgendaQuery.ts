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
  clubId: string;
  meetingNo: string;
}): Promise<PublicAgendaPayload | null> {
  const { data, error } = await supabase.rpc('get_public_meeting_agenda_by_club', {
    p_club_id: params.clubId,
    p_meeting_no: params.meetingNo,
    p_meeting_id: params.meetingId,
  });
  if (error) throw error;
  if (data == null || typeof data !== 'object') {
    if (typeof window !== 'undefined') {
      console.warn(
        '[T360 public agenda] RPC returned null. In Supabase SQL: SELECT id, is_agenda_visible FROM app_club_meeting WHERE id = $1; ' +
          'and confirm get_public_meeting_agenda_by_club + row_security migration ran on this project.'
      );
    }
    return null;
  }
  const o = data as Record<string, unknown>;
  const meeting = o.meeting as PublicAgendaMeeting | undefined;
  const clubRaw = o.club as PublicAgendaClub | Record<string, unknown> | undefined;
  const items = o.items as PublicAgendaItemRow[] | undefined;
  if (!meeting?.id || !Array.isArray(items)) {
    if (typeof window !== 'undefined') {
      console.warn('[T360 public agenda] Unexpected RPC JSON shape', {
        keys: Object.keys(o),
        hasMeetingId: !!meeting?.id,
        itemsIsArray: Array.isArray(items),
      });
    }
    return null;
  }
  const name =
    typeof clubRaw?.club_name === 'string' && clubRaw.club_name.trim() !== ''
      ? clubRaw.club_name.trim()
      : 'Club';
  const club: PublicAgendaClub = {
    club_name: name,
    club_number:
      clubRaw && typeof clubRaw === 'object' && 'club_number' in clubRaw
        ? (clubRaw.club_number as string | null)
        : null,
  };
  return { meeting, club, items };
}
