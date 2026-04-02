import { supabase } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

/** True when the remote DB schema cache has no `timer_report_assigned_by` column yet. */
export function isTimerReportAssignedBySchemaError(error: PostgrestError | null): boolean {
  if (!error || error.code !== 'PGRST204') return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('timer_report_assigned_by');
}

type MeetingRoleUpdate = Record<string, unknown>;

/**
 * PATCH `app_meeting_roles_management`. If the DB has not been migrated with
 * `timer_report_assigned_by`, retries without that key so assign/unassign still works.
 */
export async function updateMeetingRoleManagement(roleId: string, patch: MeetingRoleUpdate) {
  const first = await supabase.from('app_meeting_roles_management').update(patch as any).eq('id', roleId);
  if (
    first.error &&
    isTimerReportAssignedBySchemaError(first.error) &&
    Object.prototype.hasOwnProperty.call(patch, 'timer_report_assigned_by')
  ) {
    const { timer_report_assigned_by: _omit, ...rest } = patch;
    return supabase.from('app_meeting_roles_management').update(rest as any).eq('id', roleId);
  }
  return first;
}
