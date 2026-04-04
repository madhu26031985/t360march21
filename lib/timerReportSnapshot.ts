import { supabase } from '@/lib/supabase';
import { type MeetingVisitingGuest, parseMeetingVisitingGuests } from '@/lib/meetingVisitingGuests';

export const timerReportQueryKeys = {
  snapshot: (meetingId: string, speechCategory: string, userId: string) =>
    ['timer-report-snapshot', meetingId, speechCategory, userId] as const,
};

export type TimerReportSnapshotMember = {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type TimerReportSnapshotAssignedTimer = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
} | null;

export type TimerReportSnapshotBookedSpeaker = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

/** Matches CategoryRole rows from app_meeting_roles_management + embed shape */
export type TimerReportSnapshotCategoryRole = {
  id: string;
  role_name: string;
  booking_status: string | null;
  assigned_user_id: string | null;
  completion_notes: string | null;
  /** Omitted on older RPC payloads; treated as Available when missing. */
  role_status?: string | null;
  app_user_profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

export type TimerReportSnapshot = {
  meeting: Record<string, unknown>;
  club_id: string;
  member_directory: TimerReportSnapshotMember[];
  selected_member_ids: string[];
  assigned_timer: TimerReportSnapshotAssignedTimer;
  is_vpe: boolean;
  timer_reports: Record<string, unknown>[];
  visiting_guests: MeetingVisitingGuest[];
  category_roles: TimerReportSnapshotCategoryRole[];
  booked_speakers: TimerReportSnapshotBookedSpeaker[];
};

export type TimerReportCategoryBundle = {
  category_roles: TimerReportSnapshotCategoryRole[];
  booked_speakers: TimerReportSnapshotBookedSpeaker[];
};

export async function fetchTimerReportSnapshot(
  meetingId: string,
  speechCategory: string
): Promise<TimerReportSnapshot | null> {
  const { data, error } = await (supabase as any).rpc('get_timer_report_snapshot', {
    p_meeting_id: meetingId,
    p_speech_category: speechCategory,
  });
  if (error || data == null || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  return {
    meeting: (raw.meeting as Record<string, unknown>) || {},
    club_id: String(raw.club_id || ''),
    member_directory: Array.isArray(raw.member_directory) ? (raw.member_directory as TimerReportSnapshotMember[]) : [],
    selected_member_ids: Array.isArray(raw.selected_member_ids)
      ? (raw.selected_member_ids as string[]).filter(Boolean)
      : [],
    assigned_timer: (raw.assigned_timer as TimerReportSnapshotAssignedTimer) ?? null,
    is_vpe: Boolean(raw.is_vpe),
    timer_reports: Array.isArray(raw.timer_reports) ? (raw.timer_reports as Record<string, unknown>[]) : [],
    visiting_guests: parseMeetingVisitingGuests(raw.visiting_guests),
    category_roles: Array.isArray(raw.category_roles) ? (raw.category_roles as TimerReportSnapshotCategoryRole[]) : [],
    booked_speakers: Array.isArray(raw.booked_speakers) ? (raw.booked_speakers as TimerReportSnapshotBookedSpeaker[]) : [],
  };
}

export async function fetchTimerReportCategoryBundle(
  meetingId: string,
  speechCategory: string
): Promise<TimerReportCategoryBundle | null> {
  const { data, error } = await (supabase as any).rpc('get_timer_report_category_bundle', {
    p_meeting_id: meetingId,
    p_speech_category: speechCategory,
  });
  if (error || data == null || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  return {
    category_roles: Array.isArray(raw.category_roles) ? (raw.category_roles as TimerReportSnapshotCategoryRole[]) : [],
    booked_speakers: Array.isArray(raw.booked_speakers) ? (raw.booked_speakers as TimerReportSnapshotBookedSpeaker[]) : [],
  };
}
