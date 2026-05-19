/**
 * In-memory session cache for the Club tab so switching Home ↔ Club does not
 * wipe UI and replay heavy loaders on every visit.
 */

import {
  peekClubLandingCriticalCache,
  type ClubLandingCriticalPayload,
} from '@/lib/clubTabLandingData';

export type ClubTabFaqItem = {
  id: string;
  question: string;
  answer: string;
};

/** Mirrors secondary snapshot + FAQ loaded on the Club tab. */
export type ClubTabSecondaryPayload = {
  educationalSpeeches: unknown[];
  toastmasterThemes: unknown[];
  preparedSpeeches: unknown[];
  quoteRows: unknown[];
  idiomRows: unknown[];
  wotdRows: unknown[];
  timerMeetingWiseRows: unknown[];
  ahCounterMeetingWiseRows: unknown[];
  tableTopicQuestionRows: unknown[];
  generalEvaluatorScoringRows: unknown[];
  faqItems: ClubTabFaqItem[];
};

export type ClubTabSessionSnapshot = {
  clubId: string;
  at: number;
  hasCompletedMeeting: boolean;
  critical: ClubLandingCriticalPayload | null;
  secondary: ClubTabSecondaryPayload | null;
};

const SESSION_TTL_MS = 90_000;
/** After this age, show cached UI but refresh in the background on tab focus. */
export const CLUB_TAB_BACKGROUND_REFRESH_MS = 45_000;

let session: ClubTabSessionSnapshot | null = null;

export function peekClubTabSession(clubId: string): ClubTabSessionSnapshot | null {
  if (!session || session.clubId !== clubId) return null;
  if (Date.now() - session.at > SESSION_TTL_MS) return null;
  return session;
}

/** Return session even past TTL for instant paint while revalidating (same club only). */
export function peekClubTabSessionStale(clubId: string): ClubTabSessionSnapshot | null {
  if (!session || session.clubId !== clubId) return null;
  return session;
}

export function writeClubTabSession(partial: ClubTabSessionSnapshot): void {
  session = { ...partial, at: Date.now() };
}

export function patchClubTabSession(
  clubId: string,
  patch: Partial<Omit<ClubTabSessionSnapshot, 'clubId' | 'at'>>
): void {
  if (!session || session.clubId !== clubId) return;
  session = { ...session, ...patch, at: Date.now() };
}

export function invalidateClubTabSession(): void {
  session = null;
}

export function shouldBackgroundRefreshClubTab(clubId: string): boolean {
  const snap = peekClubTabSessionStale(clubId);
  if (!snap) return true;
  return Date.now() - snap.at > CLUB_TAB_BACKGROUND_REFRESH_MS;
}

/** Session or in-memory critical cache — safe to read before first paint. */
export function peekClubTabCriticalSync(clubId: string): ClubLandingCriticalPayload | null {
  const snap = peekClubTabSessionStale(clubId);
  if (snap?.critical) return snap.critical;
  return peekClubLandingCriticalCache(clubId);
}

export function peekClubTabSessionForHydrate(clubId: string): ClubTabSessionSnapshot | null {
  return peekClubTabSession(clubId) ?? peekClubTabSessionStale(clubId);
}
