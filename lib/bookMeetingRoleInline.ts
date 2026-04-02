import { supabase } from '@/lib/supabase';

export type BookMeetingRoleResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Books the current user on a specific `app_meeting_roles_management` row.
 * Matches `app/book-a-role.tsx` `handleBookRole` (including educational speaker side table).
 */
export async function bookMeetingRoleForCurrentUser(
  userId: string,
  roleId: string
): Promise<BookMeetingRoleResult> {
  const { data, error } = await supabase
    .from('app_meeting_roles_management')
    .update({
      assigned_user_id: userId,
      booking_status: 'booked',
      booked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', roleId)
    .is('assigned_user_id', null)
    .select('id, meeting_id, club_id, role_classification')
    .maybeSingle();

  if (error) {
    console.error('bookMeetingRoleForCurrentUser:', error);
    return { ok: false, message: 'Failed to book this role. Please try again.' };
  }

  if (!data) {
    return {
      ok: false,
      message: 'This role is no longer available. Someone else may have just booked it.',
    };
  }

  if (data.role_classification === 'educational_speaker') {
    const { data: existingRecord } = await supabase
      .from('app_meeting_educational_speaker')
      .select('id')
      .eq('meeting_id', data.meeting_id)
      .eq('speaker_user_id', userId)
      .maybeSingle();

    if (!existingRecord) {
      const { error: insertError } = await supabase.from('app_meeting_educational_speaker').insert({
        meeting_id: data.meeting_id,
        club_id: data.club_id,
        speaker_user_id: userId,
        booking_status: 'booked',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('bookMeetingRoleForCurrentUser educational insert:', insertError);
      }
    }
  }

  if (data.role_classification === 'Key Speakers') {
    const { data: existingRecord } = await supabase
      .from('app_meeting_keynote_speaker')
      .select('id')
      .eq('meeting_id', data.meeting_id)
      .eq('speaker_user_id', userId)
      .maybeSingle();

    if (!existingRecord) {
      const { error: insertError } = await supabase.from('app_meeting_keynote_speaker').insert({
        meeting_id: data.meeting_id,
        club_id: data.club_id,
        speaker_user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('bookMeetingRoleForCurrentUser keynote insert:', insertError);
      }
    }
  }

  return { ok: true };
}

export type OpenRoleFilters =
  | { eqRoleName: string }
  | { ilikeRoleName: string }
  | { orRoleName: string };

/** Finds first open (unassigned) role row for a meeting. */
export async function fetchOpenMeetingRoleId(
  meetingId: string,
  filters: OpenRoleFilters
): Promise<string | null> {
  // Match book-a-role: NULL role_status means a normal open role; only 'Deleted' is excluded.
  let q = supabase
    .from('app_meeting_roles_management')
    .select('id')
    .eq('meeting_id', meetingId)
    .or('role_status.is.null,role_status.eq.Available')
    .is('assigned_user_id', null);

  if ('orRoleName' in filters) {
    q = q.or(filters.orRoleName);
  } else if ('eqRoleName' in filters) {
    q = q.eq('role_name', filters.eqRoleName);
  } else {
    q = q.ilike('role_name', filters.ilikeRoleName);
  }

  const { data, error } = await q.limit(1).maybeSingle();

  if (error) {
    console.error('fetchOpenMeetingRoleId:', error);
    return null;
  }
  return data?.id ?? null;
}

/** Looks up an open role matching `filters`, then books it for `userId`. */
export async function bookOpenMeetingRole(
  userId: string,
  meetingId: string,
  filters: OpenRoleFilters,
  notFoundMessage = 'This role is already booked or not set up for this meeting.'
): Promise<BookMeetingRoleResult> {
  const roleId = await fetchOpenMeetingRoleId(meetingId, filters);
  if (!roleId) {
    return { ok: false, message: notFoundMessage };
  }
  return bookMeetingRoleForCurrentUser(userId, roleId);
}
