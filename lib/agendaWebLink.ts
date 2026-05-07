/**
 * Shareable public agenda URLs (no login).
 * Full share link (same agenda): /{club-slug}/agenda/{meetingNo}/{meetingId}.
 * This route is handled by a server-side preview endpoint (OG tags) and then redirects to /weblogin.
 *
 * Short share link (same agenda): /{club-slug}/a/{meetingId} when a display name is known,
 * or /a/{meetingId}. These URLs are routed through a server-side preview endpoint for WhatsApp/OG.
 *
 * These share URLs intentionally avoid /weblogin so social crawlers hit the
 * server-side preview endpoint first.
 *
 * Default host is https://app.t360.in (same as Netlify web builds via EXPO_PUBLIC_AGENDA_WEB_HOST).
 * Override with EXPO_PUBLIC_AGENDA_WEB_HOST if needed (e.g. https://t360.in once apex serves the app).
 */
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';

export const AGENDA_WEB_PATH_PREFIX = '/weblogin';
/** Must match production web so share links from iOS/Android open the same URL as the browser. */
const DEFAULT_AGENDA_WEB_HOST = 'https://app.t360.in';
/** Share-link revision to force social preview refresh on clients that cache OG responses aggressively. */
const SHARE_PREVIEW_REV = '2026-05-07-i';

function agendaWebHost(): string {
  const h = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.trim();
  if (h) return h.replace(/\/$/, '');
  return DEFAULT_AGENDA_WEB_HOST;
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
  const path = `/${clubSegment}/agenda/${num}/${params.meetingId}`;
  let url = `${agendaWebHost()}${path}`;
  const qp = new URLSearchParams();
  if (params.skin === 'minimal' || params.skin === 'vibrant') {
    qp.set('skin', params.skin);
  }
  qp.set('pv', SHARE_PREVIEW_REV);
  url += `?${qp.toString()}`;
  return url;
}

/** Compact public agenda URL; resolves the same payload as the long path (meeting UUID is authoritative). */
export function buildShortAgendaWebUrl(params: {
  meetingId: string;
  /** Club profile or club table name — adds a readable segment: /{slug}/a/{meetingId}. */
  clubDisplayName?: string | null;
  skin?: PublicAgendaSkinId;
}): string {
  const trimmed = params.clubDisplayName?.trim();
  const slug = trimmed ? slugifyClubNameForAgendaUrl(trimmed) : '';
  const path =
    trimmed && slug.length > 0
      ? `/${slug}/a/${params.meetingId}`
      : `/a/${params.meetingId}`;
  let url = `${agendaWebHost()}${path}`;
  const qp = new URLSearchParams();
  if (params.skin === 'minimal' || params.skin === 'vibrant') {
    qp.set('skin', params.skin);
  }
  qp.set('pv', SHARE_PREVIEW_REV);
  url += `?${qp.toString()}`;
  return url;
}
