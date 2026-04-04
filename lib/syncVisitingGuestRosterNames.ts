import { supabase } from '@/lib/supabase';
import {
  TIMER_GUEST_PREFIX,
  formatTimerGuestDisplayName,
  normalizeTimerGuestSpeakerKey,
  parseTimerGuestCompletionNotes,
} from '@/lib/timerGuestDisplayName';

/**
 * When a visiting guest's display name changes in `app_meeting_visiting_guests`, keep
 * `app_meeting_roles_management.completion_notes` (timer guest assignments),
 * `timer_reports.speaker_name`, `ah_counter_reports.speaker_name`, and
 * `grammarian_word_of_the_day_member_usage.member_name_manual` in sync for this meeting.
 */
export async function propagateMeetingVisitingGuestDisplayRename(params: {
  meetingId: string;
  oldRawName: string;
  newRawName: string;
  visitingGuestId: string;
}): Promise<void> {
  const { meetingId, oldRawName, newRawName, visitingGuestId } = params;
  const oldTrim = oldRawName.trim();
  const newTrim = newRawName.trim();
  if (!oldTrim || !newTrim || oldTrim === newTrim) return;

  const oldFormatted = formatTimerGuestDisplayName(oldTrim);
  const newFormatted = formatTimerGuestDisplayName(newTrim);
  if (!oldFormatted || !newFormatted) return;

  const now = new Date().toISOString();
  const oldNorm = normalizeTimerGuestSpeakerKey(oldTrim);

  const { data: roles, error: rolesErr } = await supabase
    .from('app_meeting_roles_management')
    .select('id, completion_notes')
    .eq('meeting_id', meetingId);

  if (rolesErr) {
    console.warn('propagateMeetingVisitingGuestDisplayRename: load roles', rolesErr);
  } else {
    for (const role of roles || []) {
      const parsed = parseTimerGuestCompletionNotes(role.completion_notes);
      if (!parsed) continue;
      if (normalizeTimerGuestSpeakerKey(parsed) !== oldNorm) continue;
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          completion_notes: `${TIMER_GUEST_PREFIX}${newFormatted}`,
          updated_at: now,
        })
        .eq('id', (role as { id: string }).id);
      if (error) console.warn('propagateMeetingVisitingGuestDisplayRename: role update', error);
    }
  }

  const { error: trByVg } = await supabase
    .from('timer_reports')
    .update({ speaker_name: newTrim, updated_at: now })
    .eq('meeting_id', meetingId)
    .eq('visiting_guest_id', visitingGuestId);
  if (trByVg) console.warn('propagateMeetingVisitingGuestDisplayRename: timer_reports by vg', trByVg);

  const { data: legacyTimerRows, error: legTimerErr } = await supabase
    .from('timer_reports')
    .select('id, speaker_name')
    .eq('meeting_id', meetingId)
    .is('visiting_guest_id', null);

  if (!legTimerErr && legacyTimerRows?.length) {
    for (const row of legacyTimerRows) {
      const sn = (row as { id: string; speaker_name: string | null }).speaker_name || '';
      if (normalizeTimerGuestSpeakerKey(sn) !== oldNorm) continue;
      const { error } = await supabase
        .from('timer_reports')
        .update({ speaker_name: newTrim, updated_at: now })
        .eq('id', (row as { id: string }).id);
      if (error) console.warn('propagateMeetingVisitingGuestDisplayRename: timer legacy row', error);
    }
  }

  const { error: ahByVg } = await supabase
    .from('ah_counter_reports')
    .update({ speaker_name: newTrim, updated_at: now })
    .eq('meeting_id', meetingId)
    .eq('visiting_guest_id', visitingGuestId);
  if (ahByVg) console.warn('propagateMeetingVisitingGuestDisplayRename: ah_counter_reports by vg', ahByVg);

  const { data: legacyAhRows, error: legAhErr } = await supabase
    .from('ah_counter_reports')
    .select('id, speaker_name')
    .eq('meeting_id', meetingId)
    .is('visiting_guest_id', null);

  if (!legAhErr && legacyAhRows?.length) {
    for (const row of legacyAhRows) {
      const sn = (row as { id: string; speaker_name: string | null }).speaker_name || '';
      if (normalizeTimerGuestSpeakerKey(sn) !== oldNorm) continue;
      const { error } = await supabase
        .from('ah_counter_reports')
        .update({ speaker_name: newTrim, updated_at: now })
        .eq('id', (row as { id: string }).id);
      if (error) console.warn('propagateMeetingVisitingGuestDisplayRename: ah_counter legacy row', error);
    }
  }

  const { error: wotdByVg } = await supabase
    .from('grammarian_word_of_the_day_member_usage')
    .update({ member_name_manual: newFormatted, updated_at: now })
    .eq('visiting_guest_id', visitingGuestId);
  if (wotdByVg) console.warn('propagateMeetingVisitingGuestDisplayRename: wotd by vg', wotdByVg);

  const { data: legacyWotdRows, error: legWotdErr } = await supabase
    .from('grammarian_word_of_the_day_member_usage')
    .select('id, member_name_manual, grammarian_word_of_the_day!inner(meeting_id)')
    .eq('grammarian_word_of_the_day.meeting_id', meetingId)
    .is('visiting_guest_id', null);

  if (!legWotdErr && legacyWotdRows?.length) {
    for (const row of legacyWotdRows) {
      const mn = (row as { id: string; member_name_manual: string | null }).member_name_manual || '';
      if (normalizeTimerGuestSpeakerKey(mn) !== oldNorm) continue;
      const { error } = await supabase
        .from('grammarian_word_of_the_day_member_usage')
        .update({ member_name_manual: newFormatted, updated_at: now })
        .eq('id', (row as { id: string }).id);
      if (error) console.warn('propagateMeetingVisitingGuestDisplayRename: wotd legacy row', error);
    }
  }
}
