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
  /** Meeting / Toastmaster theme of the day from public agenda RPC. */
  theme?: string | null;
  club_info_banner_color?: string | null;
  datetime_banner_color?: string | null;
  /** ExComm default for web layout; URL ?skin= overrides. */
  public_agenda_skin?: string | null;
};

export type PublicAgendaClub = {
  club_name: string;
  club_number: string | null;
  district?: string | null;
  division?: string | null;
  area?: string | null;
};

export type PublicAgendaItemRow = {
  section_name: string;
  section_description: string | null;
  section_icon: string | null;
  section_order: number;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
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

export type PublicAgendaErrorCode =
  | 'meeting_not_found'
  | 'agenda_not_public'
  | 'rpc_null'
  | 'bad_shape'
  | 'unknown_error';

export type PublicAgendaFetchResult =
  | { ok: true; data: PublicAgendaPayload }
  | { ok: false; code: PublicAgendaErrorCode; message: string };

/** RPC ignores club/meeting path segments; placeholders satisfy the signature. */
const PUBLIC_AGENDA_RPC_PLACEHOLDER_CLUB_ID = '00000000-0000-0000-0000-000000000000';

export async function fetchPublicMeetingAgendaByMeetingId(
  meetingId: string
): Promise<PublicAgendaFetchResult> {
  return fetchPublicMeetingAgenda({
    meetingId,
    clubId: PUBLIC_AGENDA_RPC_PLACEHOLDER_CLUB_ID,
    meetingNo: '0',
  });
}

export async function fetchPublicMeetingAgenda(params: {
  meetingId: string;
  clubId: string;
  meetingNo: string;
}): Promise<PublicAgendaFetchResult> {
  const { data, error } = await supabase.rpc('get_public_meeting_agenda_by_club', {
    p_club_id: params.clubId,
    p_meeting_no: params.meetingNo,
    p_meeting_id: params.meetingId,
  });
  if (error) throw error;
  if (data == null || typeof data !== 'object') {
    if (typeof window !== 'undefined') {
      console.warn(
        '[T360 public agenda] RPC returned null — check Supabase project matches site env and migrations are applied.'
      );
    }
    return {
      ok: false,
      code: 'rpc_null',
      message:
        'Could not load this agenda. Confirm this site uses the correct Supabase project and database migrations are up to date.',
    };
  }
  const o = data as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.length > 0) {
    const msg =
      typeof o.message === 'string' && o.message.trim() !== ''
        ? o.message.trim()
        : 'This agenda is not available.';
    if (o.error === 'meeting_not_found') {
      return { ok: false, code: 'meeting_not_found', message: msg };
    }
    if (o.error === 'agenda_not_public') {
      return { ok: false, code: 'agenda_not_public', message: msg };
    }
    return { ok: false, code: 'unknown_error', message: msg };
  }

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
    return {
      ok: false,
      code: 'bad_shape',
      message: 'Received an unexpected response from the server. Try again later.',
    };
  }
  const name =
    typeof clubRaw?.club_name === 'string' && clubRaw.club_name.trim() !== ''
      ? clubRaw.club_name.trim()
      : 'Club';

  /** RPC jsonb may return numbers (e.g. district 120) — coerce for UI. */
  const rpcClubFieldToString = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
    if (typeof v === 'string') {
      const t = v.trim();
      return t === '' ? null : t;
    }
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const clubObj = clubRaw && typeof clubRaw === 'object' ? (clubRaw as Record<string, unknown>) : null;

  const club: PublicAgendaClub = {
    club_name: name,
    club_number: clubObj ? rpcClubFieldToString(clubObj.club_number) : null,
    district: clubObj ? rpcClubFieldToString(clubObj.district) : null,
    division: clubObj ? rpcClubFieldToString(clubObj.division) : null,
    area: clubObj ? rpcClubFieldToString(clubObj.area) : null,
  };
  return { ok: true, data: { meeting, club, items } };
}
