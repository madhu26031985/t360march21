/**
 * In-memory cache for the Meetings tab so tab switches do not flash
 * "Loading meetings…" while replaying the same Supabase queries.
 */

export type MeetingsTabMeeting = {
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
  meeting_day: string | null;
  isPlaceholder?: boolean;
};

export type MeetingsTabSnapshot = {
  clubId: string;
  at: number;
  currentMeeting: MeetingsTabMeeting | null;
  nextMeetings: MeetingsTabMeeting[];
  meetingHistory: MeetingsTabMeeting[];
  hasOnlyOneOpenMeeting: boolean;
  vpeName: string;
};

const SESSION_TTL_MS = 90_000;
export const MEETINGS_TAB_BACKGROUND_REFRESH_MS = 45_000;

let session: MeetingsTabSnapshot | null = null;

export function peekMeetingsTabSession(clubId: string): MeetingsTabSnapshot | null {
  if (!session || session.clubId !== clubId) return null;
  if (Date.now() - session.at > SESSION_TTL_MS) return null;
  return session;
}

export function peekMeetingsTabSessionStale(clubId: string): MeetingsTabSnapshot | null {
  if (!session || session.clubId !== clubId) return null;
  return session;
}

export function writeMeetingsTabSession(snapshot: MeetingsTabSnapshot): void {
  session = { ...snapshot, at: Date.now() };
}

export function invalidateMeetingsTabSession(): void {
  session = null;
}

export function shouldBackgroundRefreshMeetingsTab(clubId: string): boolean {
  const snap = peekMeetingsTabSessionStale(clubId);
  if (!snap) return true;
  return Date.now() - snap.at > MEETINGS_TAB_BACKGROUND_REFRESH_MS;
}
