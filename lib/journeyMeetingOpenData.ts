/**
 * Pure helpers for Journey (Home) meeting-role bucketing.
 * Used to derive avatar lists and role checks from a single
 * `app_meeting_roles_management` fetch per open meeting.
 */

export type MeetingRoleRow = {
  id: string;
  assigned_user_id: string | null;
  role_name: string | null;
  role_classification: string | null;
  role_status: string | null;
};

function norm(s: string | null | undefined): string {
  return (s || '').toLowerCase();
}

export function orderedUniqueUserIds(
  rows: MeetingRoleRow[],
  predicate: (r: MeetingRoleRow) => boolean
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (!predicate(row)) continue;
    const id = row.assigned_user_id;
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function mapIdsToAvatarUrls(
  orderedIds: string[],
  urlById: Map<string, string | null | undefined>
): string[] {
  return orderedIds
    .map((id) => (urlById.get(id) || '').trim())
    .filter((u): u is string => u.length > 0);
}

export function isGrammarianRole(r: MeetingRoleRow): boolean {
  return norm(r.role_name).includes('grammarian');
}

export function isToastmasterRole(r: MeetingRoleRow): boolean {
  return norm(r.role_name).includes('toastmaster');
}

export function isEducationalSpeakerRoleRow(r: MeetingRoleRow): boolean {
  return r.role_name === 'Educational Speaker';
}

export function isPreparedSpeakerRole(r: MeetingRoleRow): boolean {
  const rc = r.role_classification || '';
  const rn = norm(r.role_name);
  if (rc === 'Prepared Speaker') return true;
  if (rn.includes('prepared') && rn.includes('speaker')) return true;
  if (rn.includes('ice') && rn.includes('breaker')) return true;
  return false;
}

export function isTableTopicsMasterRole(r: MeetingRoleRow): boolean {
  const n = norm(r.role_name);
  return n.includes('table') && n.includes('topics') && n.includes('master');
}

export function isTableTopicsSpeakerRole(r: MeetingRoleRow): boolean {
  const n = norm(r.role_name);
  return (
    n.includes('table topics speaker') ||
    n.includes('table topic speaker') ||
    n.includes('table topics participant') ||
    n.includes('table topic participant')
  );
}

const SPEECH_EVAL_CLASS = new Set([
  'Speech evaluvator',
  'Master evaluvator',
  'speech_evaluator',
  'TT _ Evaluvator',
]);

export function isSpeechEvaluatorRole(r: MeetingRoleRow): boolean {
  return SPEECH_EVAL_CLASS.has(r.role_classification || '');
}

export function isGeneralEvaluatorRole(r: MeetingRoleRow): boolean {
  if (r.role_name === 'General Evaluator') return true;
  if (r.role_classification === 'general_evaluator') return true;
  const n = norm(r.role_name);
  return n.includes('general') && n.includes('evaluator');
}

export function isTimerRole(r: MeetingRoleRow): boolean {
  return r.role_name === 'Timer' || norm(r.role_name) === 'timer';
}

export function isAhCounterRole(r: MeetingRoleRow): boolean {
  if (r.role_name === 'Ah Counter') return true;
  const n = norm(r.role_name);
  return n.includes('ah') && n.includes('counter');
}
