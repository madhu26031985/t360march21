import type { VpeNudgesSnapshot } from '@/lib/vpeNudgesSnapshot';
import { daysUntilMeeting, localISODate } from '@/lib/vpeNudgeCopy';
import { isWithinOneHourOfMeetingStart, shouldShowBookRoleNudge } from '@/lib/vpeNudgeMeetingWindow';

/**
 * One-line My Tasks reminder for VPEs — mirrors Smart Daily Insights on /vpe-nudges
 * (same RPC + 7-day book-role window + 1h-before-start pause).
 */
export function computeVpeSmartDailyHomeReminder(
  snap: VpeNudgesSnapshot | null | undefined
): { text: string } | null {
  if (!snap?.allowed) return null;
  const m = snap.meeting;
  if (!m) {
    return {
      text:
        '💡 Smart Daily Insights\nWhen you have an upcoming open meeting, daily WhatsApp nudges show here — tap to preview.',
    };
  }
  if (isWithinOneHourOfMeetingStart(m.meeting_date, m.meeting_start_time)) {
    return {
      text:
        '💡 Smart Daily Insights\nNudges pause within 1 hour of start. Tap after the meeting for the next cycle.',
    };
  }
  const today = localISODate(new Date());
  const daysUntil = Math.max(0, daysUntilMeeting(m.meeting_date, today));

  if (shouldShowBookRoleNudge(daysUntil)) {
    return {
      text: '💡 VPE Smart Insight to help you fill roles faster',
    };
  }
  return {
    text: `💡 Smart Daily Insights\nYour next meeting is in ${daysUntil} days — book-role nudges unlock within 7 days. Tap to preview.`,
  };
}
