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
      text: '💡 Smart Daily Insights\nNudges show once you have an open meeting. Tap to preview.',
    };
  }
  if (isWithinOneHourOfMeetingStart(m.meeting_date, m.meeting_start_time)) {
    return {
      text: '💡 Smart Daily Insights\nPaused near start time. Back after the meeting.',
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
    text: `💡 Smart Daily Insights\nMeeting in ${daysUntil} days · nudges start 7 days before. Tap to preview.`,
  };
}
