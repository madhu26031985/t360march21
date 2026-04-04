/** Stored in `app_meeting_roles_management.completion_notes` for timer-corner guest slots. */
export const TIMER_GUEST_PREFIX = 'timer_guest:';

export function parseTimerGuestCompletionNotes(completionNotes: string | null | undefined): string | null {
  if (!completionNotes || !completionNotes.startsWith(TIMER_GUEST_PREFIX)) return null;
  const name = completionNotes.slice(TIMER_GUEST_PREFIX.length).trim();
  return name.length > 0 ? name : null;
}

/**
 * Compare speaker names ignoring legacy "Guest " vs current "Visiting Guest " prefix
 * (timer_reports may still store the old label).
 */
export function normalizeTimerGuestSpeakerKey(name: string): string {
  return name
    .trim()
    .replace(/^visiting\s+guest\s+/i, '')
    .replace(/^guest\s+/i, '')
    .trim()
    .toLowerCase();
}

/** Display label for roster guests (e.g. "Subha" → "Visiting Guest Subha"). */
export function formatTimerGuestDisplayName(input: string): string {
  const t = input.trim();
  if (!t) return '';
  const titleCaseWord = (w: string) =>
    w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
  const titleCasePhrase = (s: string) =>
    s.split(/\s+/).filter(Boolean).map(titleCaseWord).join(' ');
  const stripped = t
    .replace(/^visiting\s+guest\s+/i, '')
    .replace(/^guest\s+/i, '')
    .trim();
  return stripped ? `Visiting Guest ${titleCasePhrase(stripped)}` : '';
}
