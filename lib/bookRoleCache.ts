import { supabase } from '@/lib/supabase';

export type BookRoleMeeting = {
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

export type BookRoleMeetingRole = {
  id: string;
  meeting_id: string;
  role_id: string;
  role_name: string;
  role_metric: string;
  assigned_user_id: string | null;
  booking_status: string;
  role_classification: string | null;
  booked_at: string | null;
  withdrawn_at: string | null;
  speech_title: string | null;
  speech_objectives: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
  };
};

export const BOOK_ROLE_CACHE_TTL_MS = 2 * 60 * 1000;

type BookRoleMeetingCacheEntry = {
  at: number;
  meetings: BookRoleMeeting[];
};
type BookRoleRolesCacheEntry = {
  at: number;
  roles: BookRoleMeetingRole[];
};

const bookRoleMeetingsCacheByClub = new Map<string, BookRoleMeetingCacheEntry>();
const bookRoleRolesCacheByMeeting = new Map<string, BookRoleRolesCacheEntry>();

export function getCachedBookRoleMeetings(clubId: string): BookRoleMeeting[] | null {
  const hit = bookRoleMeetingsCacheByClub.get(clubId);
  if (!hit) return null;
  if (Date.now() - hit.at >= BOOK_ROLE_CACHE_TTL_MS) return null;
  return hit.meetings;
}

export function setCachedBookRoleMeetings(clubId: string, meetings: BookRoleMeeting[]): void {
  bookRoleMeetingsCacheByClub.set(clubId, { at: Date.now(), meetings });
}

export function getCachedBookRoleMeetingRoles(meetingId: string): BookRoleMeetingRole[] | null {
  const hit = bookRoleRolesCacheByMeeting.get(meetingId);
  if (!hit) return null;
  if (Date.now() - hit.at >= BOOK_ROLE_CACHE_TTL_MS) return null;
  return hit.roles;
}

export function setCachedBookRoleMeetingRoles(meetingId: string, roles: BookRoleMeetingRole[]): void {
  bookRoleRolesCacheByMeeting.set(meetingId, { at: Date.now(), roles });
}

/** Warm Book a Role meetings + open-meeting roles before navigation from Home. */
export async function prefetchBookRoleSnapshot(
  clubId: string | null | undefined,
  meetingId: string | null | undefined
): Promise<void> {
  if (!clubId) return;

  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

  const { data: meetingsData, error: meetingsError } = await supabase
    .from('app_club_meeting')
    .select(
      `
      id,
      meeting_title,
      meeting_date,
      meeting_number,
      meeting_start_time,
      meeting_end_time,
      meeting_mode,
      meeting_location,
      meeting_link,
      meeting_status
    `
    )
    .eq('club_id', clubId)
    .eq('meeting_status', 'open')
    .gte('meeting_date', cutoffDate)
    .order('meeting_date', { ascending: true });

  if (!meetingsError && meetingsData) {
    const now = new Date();
    const filteredMeetings = meetingsData.filter((meeting) => {
      const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
      const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
      return hoursSinceMeetingEnd < 4;
    }) as BookRoleMeeting[];
    setCachedBookRoleMeetings(clubId, filteredMeetings);
  }

  if (!meetingId) return;
  const { data: rolesData, error: rolesError } = await supabase
    .from('app_meeting_roles_management')
    .select(
      `
      id,
      meeting_id,
      role_id,
      role_name,
      role_metric,
      assigned_user_id,
      booking_status,
      role_classification,
      booked_at,
      withdrawn_at,
      speech_title,
      speech_objectives,
      role_status,
      app_user_profiles (
        full_name,
        email
      )
    `
    )
    .eq('meeting_id', meetingId)
    .order('order_index');

  if (!rolesError && rolesData) {
    const roles = (rolesData || []).filter((r: any) => (r?.role_status ?? 'Available') !== 'Deleted') as BookRoleMeetingRole[];
    setCachedBookRoleMeetingRoles(meetingId, roles);
  }
}
