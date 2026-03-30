import { fetchMeetingAgendaSnapshot } from '@/lib/meetingAgendaSnapshot';

const DEDUPE_MS = 30_000;
let lastMeetingId = '';
let lastStart = 0;

/**
 * Warm the same snapshot RPC the Meeting Agenda screen uses (one HTTP round-trip).
 */
export function prefetchMeetingAgendaView(meetingId: string | null | undefined): void {
  if (!meetingId) return;
  const now = Date.now();
  if (lastMeetingId === meetingId && now - lastStart < DEDUPE_MS) return;
  lastMeetingId = meetingId;
  lastStart = now;

  void fetchMeetingAgendaSnapshot(meetingId);
}
