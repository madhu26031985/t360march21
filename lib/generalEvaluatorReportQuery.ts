import { supabase } from '@/lib/supabase';

export type GeReportMeeting = {
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

export type GeReportClubInfo = {
  id: string;
  name: string;
  club_number: string | null;
};

export type GeReportEvaluatorRole = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
};

export type GeReportEvaluationRow = {
  id: string;
  meeting_id: string;
  club_id: string;
  evaluator_user_id: string;
  personal_notes: string | null;
  evaluation_summary: string | null;
  what_went_well: string | null;
  what_needs_improvement: string | null;
  evaluation_data: unknown;
  is_completed: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GeneralEvaluatorReportBundle = {
  meeting: GeReportMeeting | null;
  clubInfo: GeReportClubInfo | null;
  isVPEClub: boolean;
  generalEvaluator: GeReportEvaluatorRole | null;
  geReport: GeReportEvaluationRow | null;
};

type RpcSnapshot = {
  club_id: string;
  meeting: GeReportMeeting | null;
  club: GeReportClubInfo | null;
  is_vpe_for_club: boolean;
  general_evaluator: GeReportEvaluatorRole | null;
  ge_report: GeReportEvaluationRow | null;
};

async function fetchGeneralEvaluatorReportBundleLegacy(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<GeneralEvaluatorReportBundle> {
  const [meetingRes, clubRes, vpeRes, geRes] = await Promise.all([
    supabase.from('app_club_meeting').select('*').eq('id', meetingId).single(),
    supabase.from('clubs').select('id, name, club_number').eq('id', clubId).single(),
    supabase.from('club_profiles').select('vpe_id').eq('club_id', clubId).maybeSingle(),
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
      .ilike('role_name', '%general evaluator%')
      .eq('role_status', 'Available')
      .eq('booking_status', 'booked')
      .maybeSingle(),
  ]);

  const meeting = (meetingRes.data ?? null) as GeReportMeeting | null;
  const clubInfo = (clubRes.data ?? null) as GeReportClubInfo | null;
  const isVPEClub = vpeRes.data?.vpe_id === userId;
  const generalEvaluator = (geRes.data ?? null) as GeReportEvaluatorRole | null;

  let geReport: GeReportEvaluationRow | null = null;
  if (generalEvaluator?.assigned_user_id) {
    const { data, error } = await supabase
      .from('app_meeting_ge')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('evaluator_user_id', generalEvaluator.assigned_user_id)
      .eq('booking_status', 'booked')
      .maybeSingle();
    if (!error && data) {
      geReport = data as GeReportEvaluationRow;
    }
  }

  return { meeting, clubInfo, isVPEClub, generalEvaluator, geReport };
}

/**
 * One RPC when available (single round-trip); otherwise same shape via parallel REST.
 */
export async function fetchGeneralEvaluatorReportBundle(
  meetingId: string,
  clubId: string,
  userId: string
): Promise<GeneralEvaluatorReportBundle> {
  const { data, error } = await supabase.rpc('get_general_evaluator_report_snapshot', {
    p_meeting_id: meetingId,
  });

  if (!error && data === null) {
    return fetchGeneralEvaluatorReportBundleLegacy(meetingId, clubId, userId);
  }

  if (!error && data != null && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as RpcSnapshot;
    if (row.club_id === clubId) {
      return {
        meeting: row.meeting ?? null,
        clubInfo: row.club ?? null,
        isVPEClub: Boolean(row.is_vpe_for_club),
        generalEvaluator: row.general_evaluator ?? null,
        geReport: row.ge_report ?? null,
      };
    }
  }

  if (error) {
    console.warn('get_general_evaluator_report_snapshot failed, using legacy queries:', error.message);
  }

  return fetchGeneralEvaluatorReportBundleLegacy(meetingId, clubId, userId);
}
