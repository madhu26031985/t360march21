/**
 * Hide all VPE nudges once we are within one hour of the scheduled meeting start (local time).
 */

export function isWithinOneHourOfMeetingStart(
  meetingDateISO: string,
  meetingStartTime: string | null | undefined
): boolean {
  const t = (meetingStartTime || '').trim();
  if (!t) return false;

  const dateParts = meetingDateISO.split('-').map((x) => parseInt(x, 10));
  if (dateParts.length < 3 || !dateParts[0]) return false;
  const [y, mo, d] = dateParts;

  const timeMatch = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return false;
  const hh = parseInt(timeMatch[1], 10);
  const min = parseInt(timeMatch[2], 10);
  const sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  const start = new Date(y, mo - 1, d, hh, min, sec);
  if (Number.isNaN(start.getTime())) return false;

  const oneHourBeforeStart = start.getTime() - 60 * 60 * 1000;
  return Date.now() >= oneHourBeforeStart;
}

/** Book-the-role WhatsApp nudges only apply when the meeting is in 7 calendar days or fewer. */
export function shouldShowBookRoleNudge(daysUntilMeeting: number): boolean {
  return daysUntilMeeting >= 0 && daysUntilMeeting <= 7;
}

/** Matches `isTmodRole` in vpeNudgeCopy (Toastmaster of the Day / meeting Toastmaster). */
export function isToastmasterOfTheDayRoleName(roleName: string | null | undefined): boolean {
  const n = (roleName || '').toLowerCase();
  return n.includes('toastmaster') && (n.includes('day') || n.includes('of the'));
}
