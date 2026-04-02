/**
 * Shareable public agenda URLs (no login).
 * Path includes Expo `experiments.baseUrl` so the link matches the real URL in the browser:
 * /weblogin/{club-slug}/agenda/{meetingNo}/{meetingId} (slug from club display name; legacy UUID first segment still works).
 *
 * Short share link (same agenda): /weblogin/{club-slug}/a/{meetingId} when a display name is known,
 * or /weblogin/a/{meetingId} (slug in the path is cosmetic; meeting UUID loads data).
 *
 * Shorter URLs without /weblogin still work: Netlify redirects them to this path.
 *
 * Default host is https://t360.in — or set EXPO_PUBLIC_AGENDA_WEB_HOST (e.g. https://app.t360.in).
 */
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';

export const AGENDA_WEB_PATH_PREFIX = '/weblogin';
function agendaWebHost(): string {
  const h = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.trim();
  if (h) return h.replace(/\/$/, '');
  return 'https://t360.in';
}

export function getAgendaWebHost(): string {
  return agendaWebHost();
}

/** First UUID in a path/query segment (handles pasted URL + trailing junk). */
export function extractUuidFromRouteParam(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || String(s).trim() === '') return null;
  let decoded = String(s).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* already decoded or bad % */
  }
  const m = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

/** Meeting number segment only; strips spaces or pasted text after the number. */
export function extractMeetingNoFromRouteParam(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || String(s).trim() === '') return null;
  let decoded = String(s).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* ignore */
  }
  const m = decoded.match(/^([a-zA-Z0-9._-]+)/);
  return m ? m[1] : null;
}

export function sanitizeMeetingNumberSegment(meetingNumber: string | null | undefined): string {
  if (meetingNumber == null || String(meetingNumber).trim() === '') return '0';
  const t = String(meetingNumber).trim().replace(/[^a-zA-Z0-9._-]/g, '');
  return t || '0';
}

/** Single path segment from club display name (branding); not used for authorization. */
export function slugifyClubNameForAgendaUrl(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') return 'club';
  let s = String(raw).trim().toLowerCase();
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    /* ignore */
  }
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'club';
}

export function buildAgendaWebUrl(params: {
  /** Fallback first path segment when `clubDisplayName` is missing (e.g. club UUID). */
  clubId: string;
  /** Club profile or club table name — preferred for branding in the URL. */
  clubDisplayName?: string | null;
  meetingNumber: string | null | undefined;
  meetingId: string;
  /** Append `?skin=minimal` or `?skin=vibrant` (default layout omits query). */
  skin?: PublicAgendaSkinId;
}): string {
  const num = sanitizeMeetingNumberSegment(params.meetingNumber);
  const trimmed = params.clubDisplayName?.trim();
  const clubSegment =
    trimmed && trimmed.length > 0 ? slugifyClubNameForAgendaUrl(trimmed) : params.clubId;
  const path = `${AGENDA_WEB_PATH_PREFIX}/${clubSegment}/agenda/${num}/${params.meetingId}`;
  let url = `${agendaWebHost()}${path}`;
  if (params.skin === 'minimal' || params.skin === 'vibrant') {
    url += `?skin=${params.skin}`;
  }
  return url;
}

/** Compact public agenda URL; resolves the same payload as the long path (meeting UUID is authoritative). */
export function buildShortAgendaWebUrl(params: {
  meetingId: string;
  /** Club profile or club table name — adds a readable segment: /weblogin/{slug}/a/{meetingId}. */
  clubDisplayName?: string | null;
  skin?: PublicAgendaSkinId;
}): string {
  const trimmed = params.clubDisplayName?.trim();
  const slug = trimmed ? slugifyClubNameForAgendaUrl(trimmed) : '';
  const path =
    trimmed && slug.length > 0
      ? `${AGENDA_WEB_PATH_PREFIX}/${slug}/a/${params.meetingId}`
      : `${AGENDA_WEB_PATH_PREFIX}/a/${params.meetingId}`;
  let url = `${agendaWebHost()}${path}`;
  if (params.skin === 'minimal' || params.skin === 'vibrant') {
    url += `?skin=${params.skin}`;
  }
  return url;
}
